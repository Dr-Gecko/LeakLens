import time
import argon2
import datetime
import traceback
from uuid import uuid4
from base64 import b64encode
import functions.helpers.utils as utils
from argon2 import PasswordHasher
import functions.helpers.database as database
from fastapi import Response, status,Request
from decimal import Decimal


async def top_stats_data():
    breach_query="select count(name) from breaches"
    count_query = "SELECT COUNT(*) AS total_count FROM users"
    count = await database.fetch_one(count_query, database="breaches")
    breach_count = await database.fetch_one(breach_query, database="breaches")
    stats={"total_entries":count,"breaches":breach_count}
    return utils.format_response(data=stats)




async def get_dashboard_data():
    stats_query = """
    SELECT 
        COUNT(*) AS total_count,
        COUNT(address) AS address_count,
        COUNT(phone) AS phone_count,
        COUNT(email) AS email_count,
        COUNT(DISTINCT breaches) AS breaches_count
    FROM users
    """

    map_query = """SELECT latitude, longitude, address, name, breaches from usersbackup where latitude is not null and longitude is not null"""

    country_query = """
    SELECT
        country_code,
        COUNT(country_code) AS value_occurrence
    FROM usersbackup
    WHERE country_code IS NOT NULL
    GROUP BY country_code
    ORDER BY value_occurrence DESC
    """

    stats = await database.fetch_one(stats_query, database="breaches")
    country_map = await database.fetch_all(country_query, database="breaches")

    response_data = {
        "stats": stats,
        "map": country_map,
    }

    return utils.format_response(data=response_data)

async def get_dashboard_map_bounds_data(
    north: float,
    south: float,
    east: float,
    west: float,
    offset: int = 0,
    limit: int = 5000,
):
    map_query = """
        SELECT
            latitude,
            longitude,
            address,
            name,
            breaches
        FROM usersbackup
        WHERE latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND latitude BETWEEN %s AND %s
          AND longitude BETWEEN %s AND %s
        ORDER BY latitude, longitude
        LIMIT %s OFFSET %s
    """

    rows = await database.fetch_all(
        map_query,
        (
            south,
            north,
            west,
            east,
            limit,
            offset
        ),database="breaches"
    )

    return {
        "status": "success",
        "data": rows,
        "pagination": {
            "offset": offset,
            "limit": limit,
            "returned": len(rows),
            "has_more": len(rows) == limit
        }
    }