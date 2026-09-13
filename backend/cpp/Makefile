# Linux / macOS build. Requires mysql_config (libmysqlclient-dev or brew mysql-client).
CXX      ?= g++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra
MYSQL_CFLAGS := $(shell mysql_config --cflags 2>/dev/null)
MYSQL_LIBS   := $(shell mysql_config --libs 2>/dev/null)

reminder_worker: reminder_worker.cpp
	$(CXX) $(CXXFLAGS) $(MYSQL_CFLAGS) $< -o $@ $(MYSQL_LIBS)

run: reminder_worker
	./reminder_worker

once: reminder_worker
	./reminder_worker --once

clean:
	rm -f reminder_worker
