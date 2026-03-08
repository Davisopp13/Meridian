const NEW_YORK_TZ = 'America/New_York'

function getFormatter(timeZone, options = {}) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  })
}

function getDateParts(date, timeZone) {
  const parts = getFormatter(timeZone).formatToParts(date)
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
  }
}

function parseOffsetMs(timeZoneName) {
  if (!timeZoneName || timeZoneName === 'GMT') return 0

  const match = timeZoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return 0

  const [, sign, hours, minutes = '00'] = match
  const totalMinutes = Number(hours) * 60 + Number(minutes)
  return (sign === '+' ? 1 : -1) * totalMinutes * 60 * 1000
}

function getOffsetMs(timeZone, date) {
  const parts = getFormatter(timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset',
  }).formatToParts(date)

  const timeZoneName = parts.find(part => part.type === 'timeZoneName')?.value
  return parseOffsetMs(timeZoneName)
}

function zonedMidnightToUtc(parts, timeZone) {
  let timestamp = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0)

  for (let i = 0; i < 3; i += 1) {
    const offsetMs = getOffsetMs(timeZone, new Date(timestamp))
    const nextTimestamp = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0) - offsetMs
    if (nextTimestamp === timestamp) break
    timestamp = nextTimestamp
  }

  return new Date(timestamp)
}

function addDays(parts, days) {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  next.setUTCDate(next.getUTCDate() + days)
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  }
}

function formatDateKey(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

export function getNewYorkDayRange(now = new Date()) {
  const todayParts = getDateParts(now, NEW_YORK_TZ)
  const tomorrowParts = addDays(todayParts, 1)

  return {
    timeZone: NEW_YORK_TZ,
    dateKey: formatDateKey(todayParts),
    start: zonedMidnightToUtc(todayParts, NEW_YORK_TZ),
    end: zonedMidnightToUtc(tomorrowParts, NEW_YORK_TZ),
  }
}

export function getNewYorkDateKey(now = new Date()) {
  return getNewYorkDayRange(now).dateKey
}
