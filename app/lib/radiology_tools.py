import json
from pathlib import Path

from flask import current_app, url_for


def get_radiology_images(name):
    static = Path(current_app.static_folder)
    radiology = "radiology" / Path(name)
    datafile = static / radiology / "data.json"

    if not datafile.exists():
        raise FileNotFoundError(f"Radiology: data.json does not exist at '{datafile}'")

    with open(datafile, "r") as f:
        data = json.load(f)

    for d in data:
        filename = Path(d.get("filename", ""))
        i_path = static / radiology / filename
        if not i_path.exists():
            raise FileNotFoundError(
                f"Radiology: error while listing {name}s, unable to locate '{i_path}'"
            )
        d["url"] = url_for("static", filename=str(radiology / filename))

    return data
