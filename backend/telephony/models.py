import os

from sqlalchemy import BigInteger, Boolean, Column, Integer, String, Text
from sqlalchemy.orm import declarative_base

DATABASE_URL = os.environ.get("TELEPHONY_DATABASE_URL") or os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "postgresql+psycopg2://it_user:it_secret_password@db:5432/it_dashboard"

Base = declarative_base()


class TelephonyCall(Base):
    __tablename__ = "telephony_calls"

    id = Column(Integer, primary_key=True)
    uuid = Column(String, unique=True, nullable=False)
    from_number = Column(String, default="")
    to_number = Column(String, default="")
    direction = Column(String, default="")
    start_time = Column(BigInteger, default=0)
    end_time = Column(BigInteger, default=0)
    duration = Column(Integer, default=0)
    answered = Column(Boolean, default=False)
    customer_name = Column(String, default="")
    raw_payload = Column(Text, default="")


class TelephonySettings(Base):
    __tablename__ = "telephony_settings"

    id = Column(Integer, primary_key=True)
    base_url = Column(String, default="")
    username = Column(String, default="")
    password = Column(String, default="")
    refresh_token = Column(String, default="")
    stream_enabled = Column(Boolean, default=False)
