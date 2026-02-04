from markupsafe import Markup


def checked(is_checked: bool, default: bool = True):
    if is_checked or default == True:
        return "checked"
    else:
        return ""


def value_autoselect(comparator: str, value: str):
    """
    Automatically adds `value=""` and optionally adds `selected` when value == comparator.

    Useful for: putting a `selected` on the right <option> in a <select> element.

    Motivation: you can't set <select value="whatever">, and picking the correct <option> on pageload leaves a flicker of wrongness.
    """
    output = f'value="{value}"'
    if value == comparator:
        output += " selected"
    return Markup(output)


def enabled(all_enablers: dict, this_enabler: str, default: bool):
    is_enabled = all_enablers.get(this_enabler, default)
    is_enabled = str(not is_enabled).lower()
    output = f'data-sim-enabled-by="{this_enabler}" sim-disabled="{is_enabled}"'

    return Markup(output)
