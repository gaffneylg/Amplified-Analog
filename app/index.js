/*
 * Entry point for the watch app
 */

console.log("App code started");

import clock from "clock";
import * as document from "document";

import * as health from "user-activity";
import {HeartRateSensor} from "heart-rate";
import {display} from "display";
import {vibration} from "haptics";
import {peerSocket} from "messaging";
import {preferences, units} from "user-settings";
import {me} from "appbit";
import {user} from "user-profile";
import * as fs from "fs";
import {battery} from "power";
import {decode} from "cbor";
import {inbox} from "file-transfer";


const THEMES = {
  red:    ["F93535", "CC4848", "AB4545"],
  orange: ["FF970F", "DD7F23", "B3671D"],
  yellow: ["FFFF00", "E4DB4A", "C6BC1E"],
  green:  ["14C610", "119E0E", "0D730B"],
  blue:   ["6fa8e9", "5682b4", "32547a"],
  purple: ["E86FE9", "B455B5", "79327A"],
  navy: ["5555ff", "4444ff", "4444ff"],
  grey: ["888888", "666666", "444444"],
  white: ["FFFFFF", "FFFFFF", "FFFFFF"]
};
const HOUR12 = (preferences.clockDisplay === "12h");
const PROFILE = me.permissions.granted("access_user_profile");

let weekNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

let lastUpdatedRings = 0;
let lastUpdatedHeart = 0;
let showRings = true;
let unboldStats = false;


let stats = ["none", "steps", "heart", "batt"]
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

function $(s) {
  return document.getElementById(s);
}


// Tick every second
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

  myBatt.x2 = Math.round(battery.chargeLevel*7/25) - 14;

  if(showRings || (stats.length > 0 && stats[curStat] !== "none")) {
    let nowTime = now.getTime();
    
    if(showRings) {
      if(nowTime - lastUpdatedRings > 30000) {
        lastUpdatedRings = nowTime;
      }
    }

    if(stats.length > 0 && stats[curStat] !== "none" && !display.aodActive) {
      if(stats[curStat] !== "heart") {
        updateStat();
      } else {
        if(nowTime - lastUpdatedHeart > 1600) {
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

function setAOD(on) {
  if(on) {
    clock.granularity = "minutes";
    secHand.style.display = "none";
    myStats.style.display = "none";
    // statIcon.style.display = "none";
  } else {
    clock.granularity = "seconds";  
    secHand.style.display = "inline";
    myStats.style.display = "inline";
    // statIcon.style.display = "inline";
  }
}

if(display.aodAvailable && me.permissions.granted("access_aod")) {
  display.aodAllowed = true;
  display.onchange = () => {
    setAOD(display.aodActive);
    if(!display.aodActive) onTick();
  };
  setAOD(display.aodActive);
} else {
  clock.granularity = "seconds";
}

// Update the clock every tick event
clock.addEventListener("tick", updateClock);


$("top_half").onclick = () => {
  if(!display.aodEnabled) {
    if(display.autoOff === true) {
      display.autoOff = false;
      if(!display.autoOff) $("bklight").style.display = "inline";
    } else {
      display.autoOff = true;
      if(display.autoOff) $("bklight").style.display = "none";
    }
  }
};

$("btm_half").onclick = () => {
  if(stats.length > 0) {
    curStat = (curStat + 1) % stats.length;
    if(stats[curStat] === "heart") {
      updateHeart();
    } else {
      updateStat();
    }
  }
};

// function updateRing(node, holder, goal, today) {
//   let angle = 0;
//   // if(holder === "cal") {
//   //   angle = (today.calories || 0)*360/(goal.calories || 400);
//   // } else 
//   if(holder === "step") {
//     angle = (today.steps || 0)*360/(goal.steps || 10000);
//   } 
//   // else if(holder === "dist") {
//   //   angle = (today.distance || 0)*360/(goal.distance || 7200);
//   // } else if(holder === "climb") {
//   //   angle = (today.elevationGain || 0)*360/(goal.elevationGain || 20);
//   // } else if(holder === "active") {
//   //   angle = (today.activeZoneMinutes.total || 0)*360/(goal.activeZoneMinutes.total || 30);
//   // }
//   node.sweepAngle = Math.min(360, Math.round(angle));
// }

function updateStat() {
  let today = health.today.adjusted;
  switch(stats[curStat]) {
    case "steps":
      myStats.text = today.steps; 
      let stepsIcon = "./resources/icon_steps.png";
      var statIconSvg = document.getElementById('statIconSvg');
      var statIcon = statIconSvg.getElementById('statIcon');
      statIcon.href = stepsIcon;
      break;
    // case "heart":
    //   let heartIcon = "./resources/icon_heart.png";
    //   var statIconSvg = document.getElementById('statIconSvg');
    //   var statIcon = statIconSvg.getElementById('statIcon');
    //   statIcon.href = heartIcon;
    //   updateHeart();
    //   break;
    case "batt":
      myStats.text = battery.chargeLevel + "%";
      let battIcon = "./resources/icon_battery.png";
      var statIconSvg = document.getElementById('statIconSvg');
      var statIcon = statIconSvg.getElementById('statIcon');
      statIcon.href = battIcon;
      break;
    default: 
      myStats.text = "";
      statIcon.display.style = "none"
  }
}

// function pad(n) {
//   return n < 10 ? "0" + n : n;
// }

// function round(n) {
//   n = n.toFixed(2);
//   if(n.substr(-2) === "00") return n.substr(0, n.length - 3);
//   if(n.substr(-1) === "0") return n.substr(0, n.length - 1);
//   return n;
// }

var delayHeart;

function updateHeart() {
  let h = heartSensor;
  let heartIcon = "./resources/icon_heart.png";
  var statIconSvg = document.getElementById('statIconSvg');
  var statIcon = statIconSvg.getElementById('statIcon');
  statIcon.href = heartIcon;

  if(!h) {
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
  if(!h.activated) {
    clearTimeout(delayHeart);
    delayHeart = setTimeout(() => {
      myStats.text = "--";
    }, 500);
    h.start();
  }
}

function applySettings(o) {
  if(o.theme) {
    let colors = THEMES[o.theme] || [];
    for(let i = 0; i < colors.length; i++) {
      let nodes = document.getElementsByClassName("color" + (i + 1));
      let node, j = 0;
      while(node = nodes[j++]) node.style.fill = "#" + colors[i];
    }
  }
  if(o.days) {
    weekNames = o.days;
  }
  if("hideRings" in o) {
    showRings = !o.hideRings;
    let nodes = document.getElementsByClassName("rings");
    let node, j = 0;
    while(node = nodes[j++]) node.style.display = showRings ? "inline" : "none";
  }
  if("unboldStats" in o) {
    unboldStats = o.unboldStats;
    myStats.style.fontFamily = unboldStats ? "System-Regular" : "System-Bold";
  }
  if("stats" in o) stats = o.stats;
  // if("firstStat" in o) curStat = firstStat = Math.min(o.firstStat, stats.length - 1);
  myStats.text = "";
  lastUpdatedRings = 0;
  lastUpdatedHeart = 0;
}

function parseFile(name) {
  let obj;
  try {
    obj = fs.readFileSync(name, "cbor");
  } catch(e) {
    return true;
  }

  if(name === "settings2.txt") {
    if(obj) applySettings(obj);
  }
}

function pendingFiles() {
  let found = false;
  let temp;
  while(temp = inbox.nextFile()) {
    parseFile(temp);
    found = true;
  }
  if(found) {
    display.poke();
    vibration.start("bump");
  }
}

pendingFiles();
inbox.onnewfile = pendingFiles;

if(parseFile("settings2.txt")) {
  let done = (peerSocket.readyState === peerSocket.OPEN);
  if(done) {
    peerSocket.send({getAll: 1});
  } else {
    peerSocket.onopen = () => {
      if(!done) peerSocket.send({getAll: 1});
      done = true;
    };
  }
}
