export const WEEKDAYS_SHORT = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat'
]
export const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
]
export const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]
export const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

export const getWeekdayName = (
  day: number,
  useLongFormat: boolean = false
): string => {
  return useLongFormat ? WEEKDAYS_LONG[day] : WEEKDAYS_SHORT[day]
}

export const getMonthName = (
  month: number,
  useLongFormat: boolean = false
): string => {
  return useLongFormat ? MONTHS_LONG[month] : MONTHS_SHORT[month]
}

export const getLongFormatFlag = (dateFormat: string): boolean => {
  return dateFormat === 'dddd, D MMMM'
}

export const formatDateTime = (
  date: Date,
  timeFormat?: string,
  dateFormat?: string
): { time: string; date: string } => {
  try {
    const useLongNames = getLongFormatFlag(dateFormat ?? 'ddd, D MMM')

    let timeString = ''
    if (timeFormat === 'HH:mm') {
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      timeString = `${hours}:${minutes}`
    } else {
      const hours = date.getHours()
      const minutes = date.getMinutes().toString().padStart(2, '0')
      const period = hours >= 12 ? 'PM' : 'AM'
      const displayHours = hours % 12 || 12
      timeString = `${displayHours}:${minutes} ${period}`
    }

    const day = date.getDate()
    const weekday = date.getDay()
    const month = date.getMonth()
    const weekdayName = getWeekdayName(weekday, useLongNames)
    const monthName = getMonthName(month, useLongNames)
    const dateString = `${weekdayName}, ${day} ${monthName}`

    return { time: timeString, date: dateString }
  } catch (e) {
    console.error('Error formatting date/time:', e)
    return { time: '', date: '' }
  }
}
