import os
import subprocess

from flask import current_app
from webassets.filter import Filter


class ESBuildFilter(Filter):
    name = "esbuild"

    def input(self, _in, out, **kwargs):
        working_dir = os.path.dirname(kwargs["source_path"])

        cmd = ["esbuild", kwargs["source_path"], "--bundle"]

        if current_app.debug:
            cmd += ["--define:DEBUG=true"]
        else:
            cmd += ["--minify", "--drop:console", "--drop-labels=DEV"]

        result = subprocess.run(
            cmd,
            cwd=working_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )

        out.write(result.stdout.decode())
