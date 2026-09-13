"""Use PyMySQL as the MySQLdb driver so no C build tools are needed on Windows."""
import pymysql

pymysql.install_as_MySQLdb()
