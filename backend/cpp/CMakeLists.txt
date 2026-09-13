cmake_minimum_required(VERSION 3.15)
project(barberfie_reminder_worker CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Finds MySQL Connector/C (libmysqlclient). On Windows, point CMake at the
# MySQL install:  cmake -DMYSQL_DIR="C:/Program Files/MySQL/MySQL Server 8.0" ..
if(NOT MYSQL_DIR AND DEFINED ENV{MYSQL_DIR})
  set(MYSQL_DIR $ENV{MYSQL_DIR})
endif()

find_path(MYSQL_INCLUDE_DIR mysql.h
  HINTS ${MYSQL_DIR}/include /usr/include/mysql /usr/local/include/mysql /opt/homebrew/include/mysql)
find_library(MYSQL_LIBRARY NAMES mysqlclient libmysql mysql
  HINTS ${MYSQL_DIR}/lib /usr/lib /usr/lib/x86_64-linux-gnu /usr/local/lib /opt/homebrew/lib)

if(NOT MYSQL_INCLUDE_DIR OR NOT MYSQL_LIBRARY)
  message(FATAL_ERROR "MySQL client library not found. Install libmysqlclient-dev (Linux), mysql-client (brew) or MySQL Server + Connector/C (Windows), then set -DMYSQL_DIR.")
endif()

add_executable(reminder_worker reminder_worker.cpp)
target_include_directories(reminder_worker PRIVATE ${MYSQL_INCLUDE_DIR})
target_link_libraries(reminder_worker PRIVATE ${MYSQL_LIBRARY})
if(WIN32)
  target_link_libraries(reminder_worker PRIVATE ws2_32)
endif()
