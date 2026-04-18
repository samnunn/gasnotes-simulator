from enum import Enum
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
)


class NameLookupEnum(Enum):
    @classmethod
    def _missing_(cls, value):
        # Check if the 'value' matches any member name
        if isinstance(value, str):
            for member in cls:
                if member.name == value:
                    return member
        return None


class SimEcgMorhology(NameLookupEnum):
    sinus = "Normal Sinus Rhythm"
    afib = "Atrial Fibrillation"
    avnrt = "AVNRT"
    hb2m1 = "2° Heart Block (Mobitz I)"
    hb2m2 = "    2° Heart Block (Mobitz II)"
    stemi = "STEMI"
    vfib = "Ventricular Fibrillation"
    vtach_monomorphic = "Ventricular Tachycardia"
    vtach_torsades = "Torsades de Pointes"
    flatline = "Asystole"


class SimArrestMorphology(NameLookupEnum):
    sinus = "PEA"
    flatline = "Asystole"
    vfib = "Ventricular Fibrillation"
    vtach_monomorphic = "Ventricular Tachycardia"
    vtach_torsades = "Torsades de Pointes"


class SimPlethMorphology(NameLookupEnum):
    spo2 = "Well Perfused"
    spo2_badtrace = "Poorly Perfused"


class SimArtMorphology(NameLookupEnum):
    artline = "Normal Trace"
    spo2_badtrace = "Poorly Perfused"
    artline_overdamped = "Over-Damped"
    artline_underdamped = "Under-Damped"


class SimCapnoMorpology(NameLookupEnum):
    capno_normal = "Normal"
    capno_obstructed_moderate = "Moderate Obstruction"
    capno_obstructed_severe = "Severe Obstruction"
    flatline = "Apnoea"


class SimModes(NameLookupEnum):
    alive = "Alive"
    arrested = "Arrested"


class SimStateMessage(BaseModel):
    sim_room_id: Annotated[
        str, StringConstraints(to_upper=True, min_length=6, max_length=6)
    ]
    updates: SimStateModel
    model_config = ConfigDict(extra="forbid")


EnumNameSerialiser = PlainSerializer(
    lambda e: e.name,
)

limit_int = Annotated[int, Field(ge=0, le=999)]


class SimStateModel(BaseModel):
    sim_mode: Annotated[SimModes, EnumNameSerialiser]
    cpr_active: bool
    transition_time: int
    heart_rate: int
    ecg_morphology: Annotated[SimEcgMorhology, EnumNameSerialiser]
    etco2: int
    respiratory_rate: int
    capno_morphology: Annotated[SimCapnoMorpology, EnumNameSerialiser]
    spo2: int
    spo2_morphology: Annotated[SimPlethMorphology, EnumNameSerialiser]
    artline_morphology: Annotated[SimArtMorphology, EnumNameSerialiser]
    sbp_invasive: int
    dbp_invasive: int
    map_invasive: int

    sbp_noninvasive: int
    dbp_noninvasive: int
    map_noninvasive: int

    arrest_ecg_morphology: Annotated[SimArrestMorphology, EnumNameSerialiser]
    arrest_capno_morphology: Annotated[SimCapnoMorpology, EnumNameSerialiser]
    arrest_etco2: int

    enabler_for_ecg: bool
    enabler_for_spo2: bool
    enabler_for_nibp: bool
    enabler_for_art: bool
    enabler_for_capno: bool

    limit_upper_hr: limit_int
    limit_lower_hr: limit_int
    limit_upper_spo2: limit_int
    limit_lower_spo2: limit_int
    limit_upper_rr: limit_int
    limit_lower_rr: limit_int
    limit_upper_etco2: limit_int
    limit_lower_etco2: limit_int

    limit_upper_sbp_invasive: limit_int
    limit_lower_sbp_invasive: limit_int
    limit_upper_dbp_invasive: limit_int
    limit_lower_dbp_invasive: limit_int
    limit_upper_map_invasive: limit_int
    limit_lower_map_invasive: limit_int

    limit_upper_sbp_noninvasive: limit_int
    limit_lower_sbp_noninvasive: limit_int
    limit_upper_dbp_noninvasive: limit_int
    limit_lower_dbp_noninvasive: limit_int
    limit_upper_map_noninvasive: limit_int
    limit_lower_map_noninvasive: limit_int

    model_config = ConfigDict(extra="forbid")


LIMIT_DATA = [
    ("HR", "green", "limit_upper_hr", "limit_lower_hr"),
    ("SpO<sub>2</sub>", "blue", "limit_upper_spo2", "limit_lower_spo2"),
    ("RR", "white", "limit_upper_rr", "limit_lower_rr"),
    ("CO<sub>2</sub>", "yellow", "limit_upper_etco2", "limit_lower_etco2"),
    ("SBP", "red", "limit_upper_sbp_invasive", "limit_lower_sbp_invasive"),
    ("DBP", "red", "limit_upper_dbp_invasive", "limit_lower_dbp_invasive"),
    ("MAP", "red", "limit_upper_map_invasive", "limit_lower_map_invasive"),
    ("SBP", "purple", "limit_upper_sbp_noninvasive", "limit_lower_sbp_noninvasive"),
    ("DBP", "purple", "limit_upper_dbp_noninvasive", "limit_lower_dbp_noninvasive"),
    ("MAP", "purple", "limit_upper_map_noninvasive", "limit_lower_map_noninvasive"),
]

_default_data = {
    "sim_mode": "alive",
    "cpr_active": False,
    "transition_time": 0,
    "heart_rate": 67,
    "ecg_morphology": "sinus",
    "etco2": 36,
    "respiratory_rate": 18,
    "capno_morphology": "capno_normal",
    "spo2": 99,
    "spo2_morphology": "spo2",
    "artline_morphology": "artline",
    "sbp_invasive": 119,
    "dbp_invasive": 57,
    "map_invasive": 78,
    "sbp_noninvasive": 104,
    "dbp_noninvasive": 66,
    "map_noninvasive": 78,
    "enabler_for_ecg": True,
    "enabler_for_spo2": True,
    "enabler_for_nibp": True,
    "enabler_for_art": False,
    "enabler_for_capno": False,
    "arrest_ecg_morphology": "vfib",
    "arrest_capno_morphology": "flatline",
    "arrest_etco2": 0,
    "limit_upper_hr": 100,
    "limit_lower_hr": 50,
    "limit_upper_spo2": 100,
    "limit_lower_spo2": 94,
    "limit_upper_rr": 20,
    "limit_lower_rr": 8,
    "limit_upper_etco2": 45,
    "limit_lower_etco2": 35,
    "limit_upper_sbp_invasive": 160,
    "limit_lower_sbp_invasive": 90,
    "limit_upper_dbp_invasive": 90,
    "limit_lower_dbp_invasive": 40,
    "limit_upper_map_invasive": 120,
    "limit_lower_map_invasive": 60,
    "limit_upper_sbp_noninvasive": 160,
    "limit_lower_sbp_noninvasive": 90,
    "limit_upper_dbp_noninvasive": 90,
    "limit_lower_dbp_noninvasive": 40,
    "limit_upper_map_noninvasive": 120,
    "limit_lower_map_noninvasive": 60,
}
_demo_data = {**_default_data, "enabler_for_capno": True, "enabler_for_art": True}

DEFAULT_DATA: SimStateModel = SimStateModel.model_validate(_default_data).model_dump(
    mode="json"
)
DEMO_DATA: SimStateModel = SimStateModel.model_validate(_demo_data).model_dump(
    mode="json"
)
