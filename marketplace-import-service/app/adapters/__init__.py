from app.adapters.also import AlsoAdapter
from app.adapters.amazon import AmazonAdapter
from app.adapters.td_synnex import TDSynnexAdapter


def get_adapters():
    return {
        "td_synnex": TDSynnexAdapter(),
        "also": AlsoAdapter(),
        "amazon": AmazonAdapter(),
    }
