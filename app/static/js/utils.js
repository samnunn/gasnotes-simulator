export function renderSecondsAsMMSS(sec) {
    let minutes = Math.max(0, Math.floor(sec / 60));
    let seconds = Math.max(0, sec % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
