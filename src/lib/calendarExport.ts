import { format, addDays, startOfMonth, endOfMonth, addMonths } from 'date-fns';

interface ScheduleConfig {
  pattern: string;
  customPattern?: number[];
  startDate: Date;
  startingParent: 'A' | 'B';
  exchangeTime: string;
  exchangeLocation: string;
  holidays: { name: string; rule: string; enabled: boolean }[];
}

const PATTERN_DEFINITIONS: Record<string, number[]> = {
  "alternating-weeks": [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
  "2-2-3": [0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1],
  "2-2-5-5": [0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1],
  "3-4-4-3": [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
  "every-other-weekend": [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
};

function getParentForDate(date: Date, config: ScheduleConfig): 'A' | 'B' {
  const pattern = config.customPattern || PATTERN_DEFINITIONS[config.pattern] || PATTERN_DEFINITIONS["alternating-weeks"];
  const startDate = new Date(config.startDate);
  startDate.setHours(0, 0, 0, 0);
  
  const diffTime = date.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (24 * 60 * 60 * 1000));
  const patternIndex = ((diffDays % pattern.length) + pattern.length) % pattern.length;
  
  const parentFromPattern = pattern[patternIndex] === 0 ? 'A' : 'B';
  
  if (config.startingParent === 'B') {
    return parentFromPattern === 'A' ? 'B' : 'A';
  }
  
  return parentFromPattern;
}

function escapeICS(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatICSDate(date: Date): string {
  return format(date, "yyyyMMdd");
}

function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@coparrent.com`;
}

export function generateICSFile(
  config: ScheduleConfig,
  parentAName: string,
  parentBName: string,
  monthsAhead: number = 12
): string {
  const events: string[] = [];
  const startDate = new Date();
  const endDate = addMonths(startDate, monthsAhead);
  
  let currentDate = startOfMonth(startDate);
  let currentParent = getParentForDate(currentDate, config);
  let blockStart = new Date(currentDate);
  
  while (currentDate <= endDate) {
    const nextDate = addDays(currentDate, 1);
    const nextParent = getParentForDate(nextDate, config);
    
    if (nextParent !== currentParent || nextDate > endDate) {
      // End of block, create event
      const parentName = currentParent === 'A' ? parentAName : parentBName;
      const summary = `Custody: ${parentName}`;
      const location = config.exchangeLocation || '';
      
      const eventStart = formatICSDate(blockStart);
      const eventEnd = formatICSDate(addDays(currentDate, 1));
      
      events.push([
        'BEGIN:VEVENT',
        `UID:${generateUID()}`,
        `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`,
        `DTSTART;VALUE=DATE:${eventStart}`,
        `DTEND;VALUE=DATE:${eventEnd}`,
        `SUMMARY:${escapeICS(summary)}`,
        location ? `LOCATION:${escapeICS(location)}` : '',
        `DESCRIPTION:${escapeICS(`Exchange time: ${config.exchangeTime}`)}`,
        'TRANSP:TRANSPARENT',
        'END:VEVENT'
      ].filter(Boolean).join('\r\n'));
      
      blockStart = new Date(nextDate);
    }
    
    currentParent = nextParent;
    currentDate = nextDate;
  }
  
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CoParrent//Custody Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Custody Schedule',
    ...events,
    'END:VCALENDAR'
  ].join('\r\n');
  
  return icsContent;
}

export function downloadICSFile(
  config: ScheduleConfig,
  parentAName: string,
  parentBName: string,
  monthsAhead: number = 12
): void {
  const icsContent = generateICSFile(config, parentAName, parentBName, monthsAhead);
  
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `custody-schedule-${format(new Date(), 'yyyy-MM-dd')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateGoogleCalendarURL(
  config: ScheduleConfig,
  parentName: string,
  date: Date
): string {
  const title = encodeURIComponent(`Custody: ${parentName}`);
  const details = encodeURIComponent(`Exchange time: ${config.exchangeTime}\nLocation: ${config.exchangeLocation || 'Not specified'}`);
  const location = encodeURIComponent(config.exchangeLocation || '');
  const dates = `${formatICSDate(date)}/${formatICSDate(addDays(date, 1))}`;
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}

export function generateAppleCalendarSubscriptionInfo(): {
  title: string;
  description: string;
  instructions: string[];
} {
  return {
    title: 'Subscribe to Custody Calendar',
    description: 'Download the .ics file and import it to your Apple Calendar.',
    instructions: [
      '1. Download the calendar file (.ics)',
      '2. Open the downloaded file on your iPhone/Mac',
      '3. When prompted, choose to add the events to your calendar',
      '4. Select which calendar to add the events to',
      '5. Tap "Add All" to import all custody events'
    ]
  };
}
