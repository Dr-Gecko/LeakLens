import logging
import argparse
import mysql.connector


parser = argparse.ArgumentParser()
parser.add_argument("-H", "--mysql-host",)
parser.add_argument("-p", "--mysql-port",)
parser.add_argument("-u", "--mysql-username",)
parser.add_argument("-P", "--mysql-password",)
parser.add_argument("-d", "--mysql-database",)
parser.add_argument("-t", "--mysql-table",)
args = parser.parse_args()
logging.basicConfig(level=logging.INFO,format="[%(asctime)s][%(name)s][%(levelname)s]: %(message)s",datefmt="%H:%M:%S")
logger = logging.getLogger(f"DEDUPLICATOR: {args.mysql_table.upper()}")

logger.info("Logging into SQL")
connection=mysql.connector.connect(host=args.mysql_host,port=args.mysql_port,user=args.mysql_username,password=args.mysql_password,database=args.mysql_database)
logger.info("Logged into SQL")
cursor=connection.cursor()
logger.info("Fetching Count")
cursor.execute(f"select count(*) from {args.mysql_table}")
first_count = cursor.fetchone()
logger.info(f"First count: {str(first_count[0])}")
logger.info(f"Removing possible existing dedup table")
cursor.execute(f"DROP TABLE IF EXISTS {args.mysql_table}_deduped")
logger.info(f"Creating table {args.mysql_table}_deduped")
cursor.execute(f"create table {args.mysql_table}_deduped like {args.mysql_table}")
logger.info(f"Deduping table {args.mysql_table}")
cursor.execute(f"INSERT INTO {args.mysql_table}_deduped SELECT * FROM {args.mysql_table} WHERE id IN (SELECT min_id FROM (SELECT MIN(id) AS min_id FROM {args.mysql_table} GROUP BY name, socials, pii, extra) AS keep);")
logger.info(f"Getting final count")
cursor.execute(f"select count(*) from {args.mysql_table}_deduped")
final_count=cursor.fetchone()
logger.info(f"Final count {final_count[0]}")
try:
    percent=((first_count[0]-final_count[0])/first_count[0])*100
except ZeroDivisionError:
    percent=100
if percent>30:
   logger.warning(f"{percent} removed not deleting old table")
else:
    logger.info(f"{percent} removed")
    logger.info(f"Moving deduped table to main table")
    cursor.execute(f"RENAME TABLE {args.mysql_table} TO {args.mysql_table}_old, {args.mysql_table}_deduped TO {args.mysql_table};")
    logger.info(f"Deleting duplicate table")
    cursor.execute(f"DROP TABLE {args.mysql_table}_old")
