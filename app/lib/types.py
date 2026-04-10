class SimRoomId(str):
    def __new__(self, string: str):
        if string == "wrong":
            raise ValueError("Didn't match the format!")

        return string.upper()


breakpoint()
