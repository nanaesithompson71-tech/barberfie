// ==========================================================
// BARBERFIE - appointment reminder worker (C++17)
//
// Polls MySQL for confirmed bookings starting within the next
// REMINDER_HOURS_AHEAD hours that have not been reminded yet,
// "sends" a reminder for each (stdout now; plug in an SMS /
// email / WhatsApp provider in send_reminder), then marks the
// booking and writes to reminder_log.
//
// Build (see Makefile / CMakeLists.txt):
//   g++ -std=c++17 -O2 reminder_worker.cpp -o reminder_worker $(mysql_config --cflags --libs)
// Run:
//   ./reminder_worker            # loops forever
//   ./reminder_worker --once     # single pass, useful for cron
// ==========================================================

#include <mysql.h>

#include <chrono>
#include <csignal>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

namespace {

volatile std::sig_atomic_t g_stop = 0;
void on_signal(int) { g_stop = 1; }

// ---------- .env loader (same file the other services use) ----------
std::map<std::string, std::string> load_env(const std::string& path) {
    std::map<std::string, std::string> env;
    std::ifstream in(path);
    std::string line;
    while (std::getline(in, line)) {
        if (line.empty() || line[0] == '#') continue;
        auto eq = line.find('=');
        if (eq == std::string::npos) continue;
        auto trim = [](std::string s) {
            const char* ws = " \t\r\n";
            s.erase(0, s.find_first_not_of(ws));
            s.erase(s.find_last_not_of(ws) + 1);
            return s;
        };
        env[trim(line.substr(0, eq))] = trim(line.substr(eq + 1));
    }
    return env;
}

std::string get(const std::map<std::string, std::string>& env, const char* key, const std::string& fallback) {
    if (const char* v = std::getenv(key)) return v;
    auto it = env.find(key);
    return it == env.end() ? fallback : it->second;
}

std::string now_string() {
    auto t = std::chrono::system_clock::to_time_t(std::chrono::system_clock::now());
    char buf[32];
    std::strftime(buf, sizeof buf, "%Y-%m-%d %H:%M:%S", std::localtime(&t));
    return buf;
}

// ---------- Tiny RAII wrapper around the MySQL C API ----------
class Db {
public:
    Db(const std::string& host, unsigned port, const std::string& user, const std::string& pass, const std::string& name) {
        conn_ = mysql_init(nullptr);
        if (!conn_) throw std::runtime_error("mysql_init failed");
        bool reconnect = true;
        mysql_options(conn_, MYSQL_OPT_RECONNECT, &reconnect);
        mysql_options(conn_, MYSQL_SET_CHARSET_NAME, "utf8mb4");
        if (!mysql_real_connect(conn_, host.c_str(), user.c_str(), pass.c_str(), name.c_str(), port, nullptr, 0)) {
            std::string err = mysql_error(conn_);
            mysql_close(conn_);
            throw std::runtime_error("connect failed: " + err);
        }
    }
    ~Db() { if (conn_) mysql_close(conn_); }
    Db(const Db&) = delete;
    Db& operator=(const Db&) = delete;

    void exec(const std::string& sql) {
        if (mysql_query(conn_, sql.c_str()) != 0) throw std::runtime_error(std::string("query failed: ") + mysql_error(conn_));
    }

    std::vector<std::vector<std::string>> rows(const std::string& sql) {
        exec(sql);
        MYSQL_RES* res = mysql_store_result(conn_);
        if (!res) throw std::runtime_error(std::string("store_result failed: ") + mysql_error(conn_));
        std::vector<std::vector<std::string>> out;
        unsigned cols = mysql_num_fields(res);
        while (MYSQL_ROW r = mysql_fetch_row(res)) {
            std::vector<std::string> row;
            for (unsigned i = 0; i < cols; ++i) row.emplace_back(r[i] ? r[i] : "");
            out.push_back(std::move(row));
        }
        mysql_free_result(res);
        return out;
    }

    std::string escape(const std::string& s) {
        std::string out(s.size() * 2 + 1, '\0');
        auto n = mysql_real_escape_string(conn_, out.data(), s.c_str(), static_cast<unsigned long>(s.size()));
        out.resize(n);
        return out;
    }

private:
    MYSQL* conn_ = nullptr;
};

struct Reminder {
    std::string booking_id, customer, email, phone, service, barber, date, time;
    bool wants_whatsapp = false;
    bool wants_reminders = true;
};

// ---------- Where a real SMS / email / WhatsApp provider would go ----------
// Return the channel used so it can be logged.
std::string send_reminder(const Reminder& r) {
    std::string channel = r.wants_whatsapp ? "whatsapp" : (r.phone.empty() ? "email" : "sms");
    std::cout << "[" << now_string() << "] " << channel << " -> " << r.customer
              << " (" << (channel == "email" ? r.email : r.phone) << "): "
              << "Reminder: " << r.service << " with " << r.barber
              << " tomorrow " << r.date << " at " << r.time.substr(0, 5) << " at BARBERFIE.\n";
    return channel;
}

int run_pass(Db& db, int hours_ahead) {
    std::ostringstream sql;
    sql << "SELECT b.id, CONCAT(u.first_name,' ',u.last_name), u.email, IFNULL(u.phone,''), s.name, "
           "IFNULL(br.name,'your barber'), b.booking_date, b.booking_time, u.pref_whatsapp, u.pref_reminders "
           "FROM bookings b JOIN users u ON u.id = b.user_id JOIN services s ON s.id = b.service_id "
           "LEFT JOIN barbers br ON br.id = b.barber_id "
           "WHERE b.status = 'confirmed' AND b.reminder_sent = 0 "
           "AND TIMESTAMP(b.booking_date, b.booking_time) BETWEEN NOW() AND NOW() + INTERVAL " << hours_ahead << " HOUR";

    int sent = 0;
    for (const auto& row : db.rows(sql.str())) {
        Reminder r{row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8] == "1", row[9] == "1"};

        if (!r.wants_reminders) {
            // Respect the customer's preference but do not re-check every pass.
            db.exec("UPDATE bookings SET reminder_sent = 1 WHERE id = " + r.booking_id);
            continue;
        }

        std::string channel = send_reminder(r);
        db.exec("UPDATE bookings SET reminder_sent = 1 WHERE id = " + r.booking_id);
        db.exec("INSERT INTO reminder_log (booking_id, channel) VALUES (" + r.booking_id + ", '" + db.escape(channel) + "')");
        ++sent;
    }
    return sent;
}

}  // namespace

int main(int argc, char** argv) {
    bool once = false;
    for (int i = 1; i < argc; ++i) if (std::strcmp(argv[i], "--once") == 0) once = true;

    auto env = load_env("../.env");
    if (env.empty()) env = load_env(".env");

    const std::string host = get(env, "DB_HOST", "127.0.0.1");
    const unsigned port = static_cast<unsigned>(std::stoul(get(env, "DB_PORT", "3306")));
    const std::string user = get(env, "DB_USER", "barberfie");
    const std::string pass = get(env, "DB_PASSWORD", "");
    const std::string name = get(env, "DB_NAME", "barberfie");
    const int hours_ahead = std::stoi(get(env, "REMINDER_HOURS_AHEAD", "24"));
    const int interval = std::stoi(get(env, "REMINDER_INTERVAL_SECONDS", "300"));

    std::signal(SIGINT, on_signal);
    std::signal(SIGTERM, on_signal);

    try {
        Db db(host, port, user, pass, name);
        std::cout << "[" << now_string() << "] reminder worker connected to " << name << "@" << host
                  << " (window " << hours_ahead << "h, every " << interval << "s)\n";

        do {
            // Honour the shop-level switch set from the admin dashboard.
            auto flag = db.rows("SELECT setting_value FROM shop_settings WHERE setting_key = 'send_reminders'");
            bool enabled = flag.empty() || flag[0][0] != "0";
            if (enabled) {
                int n = run_pass(db, hours_ahead);
                if (n) std::cout << "[" << now_string() << "] sent " << n << " reminder(s)\n";
            } else {
                std::cout << "[" << now_string() << "] reminders are switched off in shop settings\n";
            }
            if (once) break;
            for (int s = 0; s < interval && !g_stop; ++s) std::this_thread::sleep_for(std::chrono::seconds(1));
        } while (!g_stop);

        std::cout << "[" << now_string() << "] reminder worker stopped\n";
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "[" << now_string() << "] fatal: " << e.what() << "\n";
        return 1;
    }
}
