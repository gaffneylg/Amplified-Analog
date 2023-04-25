/*
 * Entry point for the watch face
 */

console.log("App code started");

import * as document from "document";
import * as health from "user-activity";
import {battery} from "power";
import {clock} from "clock";
import {display} from "display";
import {HeartRateSensor} from "heart-rate";

let lastUpdatedHeart = 0;
let stats = ["steps", "heart", "batt"]
let curStat = 0;
let heartSensor;
let myDate = $("mydate");
let myWeek = $("myweek");
let myStats = $("mystats");
let statIcon = $("staticon");
let myBatt = $("batt");
let twelve = $("twelve");
let three = $("three");
let six = $("six");
let nine = $("nine");
let weekNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function $(s) {
  return document.getElementById(s);
}

// Tick every second and update the clock
clock.granularity = "seconds";
clock.ontick = (evt) => {
  updateClock()
}

let hourHand = document.getElementById("hours");
let minHand = document.getElementById("minutes");
let secHand = document.getElementById("seconds");

// Returns an angle (0-360) for the current hour in the day, including minutes
function hoursToAngle(hours, minutes) {
  let hourAngle = (360 / 12) * hours;
  let minAngle = (360 / 12 / 60) * minutes;
  return hourAngle + minAngle;
}

// Returns an angle (0-360) for minutes
function minutesToAngle(minutes) {
  return (360 / 60) * minutes;
}

// Returns an angle (0-360) for seconds
function secondsToAngle(seconds) {
  return (360 / 60) * seconds;
}

// Rotate the hands every tick
function updateClock() {
  let now = new Date();
  myDate.text = now.getDate();
  myWeek.text = weekNames[now.getDay()];
  twelve.text = "XII";
  three.text = "III";
  six.text = "VI";
  nine.text = "IX";
  statIcon = "";

  let hours = now.getHours() % 12;
  let mins = now.getMinutes();
  let secs = now.getSeconds();

  hourHand.groupTransform.rotate.angle = hoursToAngle(hours, mins);
  minHand.groupTransform.rotate.angle = minutesToAngle(mins);
  secHand.groupTransform.rotate.angle = secondsToAngle(secs);

  myBatt.x2 = Math.round(battery.chargeLevel * 7 / 25) - 14;

  if (stats.length > 0) {
    let nowTime = now.getTime();

    if (stats.length > 0 && !display.aodActive) {
      if (stats[curStat] !== "heart") {
        updateStat();
      } else {
        if (nowTime - lastUpdatedHeart > 1600) {
          lastUpdatedHeart = nowTime;
          updateHeart();
        }
      }
    } else {
      myStats.text = "";
      statIcon.href = "";
    }
  }
}

$("btm_half").onclick = () => {
  if (stats.length > 0) {
    curStat = (curStat + 1) % stats.length;
    if (stats[curStat] === "heart") {
      updateHeart();
    } else {
      updateStat();
    }
  }
};

function updateStat() {
  let today = health.today.adjusted;
  switch (stats[curStat]) {
    case "steps":
      myStats.text = today.steps;
      var statIconSvg = document.getElementById('statIconSvg');
      var statIcon = statIconSvg.getElementById('statIcon');
      statIcon.href = "./resources/icon_steps.png";
      break;
    case "batt":
      myStats.text = battery.chargeLevel + "%";
      var statIconSvg = document.getElementById('statIconSvg');
      var statIcon = statIconSvg.getElementById('statIcon');
      let battIcon = "./resources/icon_battery.png";
      statIcon.href = battIcon;
      break;
    default:
      myStats.text = "";
      statIcon.href = "";
      break;
  }
}

var delayHeart;

function updateHeart() {
  let h = heartSensor;
  let heartIcon = "./resources/icon_heart.png";
  var statIconSvg = document.getElementById('statIconSvg');
  var statIcon = statIconSvg.getElementById('statIcon');
  statIcon.href = heartIcon;

  if (!h) {
    heartSensor = h = new HeartRateSensor();
    h.onreading = () => {
      setTimeout(() => h.stop(), 100);
      clearTimeout(delayHeart);
      myStats.text = h.heartRate;
    };
    h.onerror = () => {
      setTimeout(() => h.stop(), 100);
      clearTimeout(delayHeart);
      myStats.text = "--";
    };
  }
  if (!h.activated) {
    clearTimeout(delayHeart);
    delayHeart = setTimeout(() => {
      myStats.text = "--";
    }, 500);
    h.start();
  }
}
