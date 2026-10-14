import test from 'node:test';
import assert from 'node:assert/strict';
import {dualDates,clockTime} from '../date-display.js';
test('Umm al-Qura and Gregorian dates use Latin digits in all formats',()=>{for(const mode of ['named','numeric','weekday']){const d=dualDates('2026-10-14',mode);assert.match(d.hijri,/1448/);assert.match(d.gregorian,/2026/);assert.doesNotMatch(d.hijri+d.gregorian,/[٠-٩۰-۹]/);}assert.equal(dualDates('2026-10-14','numeric').hijri,'03 / 05 / 1448');assert.match(dualDates('2026-10-14','weekday').gregorian,/الأربعاء، 14 أكتوبر 2026/);});
test('invalid dates stay empty; clock uses patient timezone without seconds',()=>{assert.deepEqual(dualDates('2026-02-30'),{hijri:'',gregorian:''});assert.equal(clockTime(new Date('2026-10-14T21:07:30Z'),'Asia/Riyadh'),'00:07');assert.equal(clockTime(new Date('2026-10-14T21:07:30Z'),'Asia/Dubai'),'01:07');});
