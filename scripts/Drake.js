const fs = require("fs");
const path = require("path");

// ==========================================
// EXCLUSIVE OWNER ID (TROPA MO LANG)
const DRAKE_OWNER_ID = "61593899944181";
// ==========================================

module.exports.config = {
  name: "drake",
  version: "1.0.0",
  hasPermission: 2,
  credits: "Drake Engine",
  description: "Drake Bot: Saiyan Prince Auto-Tease System with Zero Error Guard.",
  usePrefix: true,
  commandCategory: "Admin",
  usages: "/drake on — Power Up Drake Engine sa GC\n" +
          "/drake lockname <pangalan> — Set and lock GC title\n" +
          "/drake setnick <nickname> — Change nicknames\n" +
          "/drake welcome <on/off> — Auto welcome toggle\n" +
          "/drake target @mention — Target specific user\n" +
          "/drake untarget — Remove target\n" +
          "/drake off — Power Down Engine\n" +
          "/drake status — View Engine stats",
  cooldowns: 3
};

const DB_FILE = path.join(__dirname, "drake_settings.json");

// TIMING & ANTI-SPAM SETTINGS
const REPLY_INTERVAL = 3000; // Exact 3s Delay
const SPAM_TIME_FRAME = 7000;
const MAX_ALLOWED_MSGS = 3;

const cooldownTracker = {};
const spamRegistry = {};

// DRAKE SELF REACTION EMOJIS (SAIYAN ENERGY)
const DRAKE_SELF_REACTIONS = ["⚡", "🔥", "💥", "🐉", "🌀", "⚔️", "👑"];

// 🐉🔥 DRAKE (SAIYAN PRINCE) ROAST LINES
const DRAKE_TEXT_ROASTS = [
  "Napakahina ng Cursed Power/Ki mo. Lumayo ka sa paningin ni Prince Drake!",
  "Ganyan lang ba ang kaya mo? Parang hindi ka man lang nag-ensayo bago pumasok sa arena.",
  "Sino ang nagbigay sa'yo ng lakas ng loob na magsalita sa harap ng isang Saiyan?",
  "Tigilan mo ang pagtahol. Masyadong mababa ang Power Level mo para pansinin ko.",
  "Kahit sumabog ang buong Planet Namek, hindi magbabago ang katotohanang mahina ka.",
  "Akala mo ba nakakatakot ka? Isang Final Flash lang ang katapat ng buong pagkatao mo.",
  "Masyado kang maingay para sa isang nilalang na madaling matalo sa isang jolt ng energy.",
  "Magpa-power up ka muna bago ka sumagot sa akin. Nakakabagot ka kausap.",
  "Tumingin ka sa ibaba, nandoon ang pwesto ng mga tulad mong mababa ang tingin sa sarili.",
  "Huwag mong sukatin ang galit ng isang Prinsipe. Isang Kamehameha lang, bura ka.",
  "Puro ka dada. Wala ka namang maipakitang magandang laban.",
  "Napakababaw ng diskarte mo. Mabilis ka pang ma-outmaneuver sa laban.",
  "Ganyan ba magsalita ang mga uod kapag alam nilang matatalo na sila?",
  "Matutong lumugar. Isa ka lang distraction sa tunay na pagsasanay ko.",
  "Isang jolt lang ng Final Flash, magiging alikabok ka na sa outer space."
];

// 🎨 STICKER ROASTS
const DRAKE_STICKER_ROASTS = [
  "Sticker lang ang kaya ng Power Level mo? Napaka-mababang klase ng kalaban.",
  "Walang epekto 'yang larawan mo sa aura ni Drake. Magsalita ka nang maayos!",
  "Nagpadala ka pa ng sticker, mukha ka namang basang sisiw sa arena.",
  "Puro ka graphics, wala namang maipakitang totoong lakas."
];

// 🤡 EMOJI ROASTS
const DRAKE_EMOJI_ROASTS = [
  "Puro ka emoji. Ubos na ba ang stamina ng utak mo?",
  "Tawa ka pa sa emoji mo. Makikita natin kung tatawa ka pa kapag pinalabas ko ang buong lakas.",
  "Anong ibig sabihin ng simbolo na 'yan? Ang hina ng argumento mo.",
  "Emoji na lang ba ang natitirang sandata mo, alipin?"
];

// 💡 DRAKE TAUNTS / SILENT MENTIONS
const DRAKE_FOOTERS = [
  "\n\n⚡ @silent *Prince Drake: Kneel before the ultimate Saiyan Power.*",
  "\n\n🔥 @silent *Prince Drake: Your power level is far too low.*",
  "\n\n💥 @silent *Prince Drake: Prepare to be erased by Final Flash!*",
  "\n\n🐉 @silent *Prince Drake: Do not waste my precious training time.*",
  "\n\n🌀 @silent *Prince Drake: You are completely outclassed here.*"
];

function fetchDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    }
  } catch (err) {}
  return { threads: {} };
}

function persistDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {}
}

function checkActiveStatus(tID) {
  const db = fetchDatabase();
  const info = db.threads ? db.threads[tID] : null;
  return info && info.expiry && Number(info.expiry) > Date.now();
}

function fetchRemainingTime(tID) {
  const db = fetchDatabase();
  const info = db.threads ? db.threads[tID] : null;
  if (!info || !info.expiry) return 0;
  const rem = Number(info.expiry) - Date.now();
  return rem > 0 ? rem : 0;
}

function detectSpammer(uID) {
  const currentTime = Date.now();
  if (!spamRegistry[uID]) spamRegistry[uID] = [];
  spamRegistry[uID] = spamRegistry[uID].filter(timestamp => currentTime - timestamp < SPAM_TIME_FRAME);
  spamRegistry[uID].push(currentTime);

  return spamRegistry[uID].length > MAX_ALLOWED_MSGS;
}

function batchRenameMembers(api, tID, newNick) {
  try {
    api.getThreadInfo(tID, (err, threadInfo) => {
      if (err || !threadInfo || !threadInfo.participantIDs) return;
      threadInfo.participantIDs.forEach((id, idx) => {
        setTimeout(() => {
          try {
            api.changeNickname(newNick, tID, id, () => {});
          } catch (e) {}
        }, idx * 2200);
      });
    });
  } catch (e) {}
}

function dispatchSilentTagReply(api, tID, text, replyMsgID, cb) {
  try {
    api.getThreadInfo(tID, (err, threadInfo) => {
      let tags = [];
      if (!err && threadInfo && threadInfo.participantIDs) {
        tags = threadInfo.participantIDs.map(id => ({
          tag: "@silent",
          id: id
        }));
      }

      const payload = {
        body: text,
        mentions: tags
      };

      api.sendMessage(payload, tID, cb || (() => {}), replyMsgID);
    });
  } catch (e) {}
}

// ===== LISTEN EVENT HANDLER =====
module.exports.handleEvent = async function ({ api, event }) {
  try {
    const { threadID, senderID, body, messageID, logMessageType, logMessageData, type, attachments } = event;
    if (!threadID || !senderID) return;

    const currentBotID = api.getCurrentUserID();
    const db = fetchDatabase();
    const tData = db.threads ? db.threads[threadID] : null;

    // 1. AUTO WELCOME
    if (logMessageType === "log:subscribe") {
      const addedList = logMessageData ? logMessageData.addedParticipants || [] : [];
      if (tData && tData.welcomeOn) {
        addedList.forEach((person) => {
          const targetName = person.fullName || "Bagong Fighter";
          
          dispatchSilentTagReply(
            api,
            threadID,
            `🔥 @silent *Prince Drake:* Bagong warrior sa arena? Maligayang pagdating, ${targetName}. Siguraduhin mong mataas ang Power Level mo rito! ⚡`,
            null
          );

          if (tData.autoNick) {
            setTimeout(() => {
              try {
                api.changeNickname(tData.autoNick, threadID, person.userFbId, () => {});
              } catch (e) {}
            }, 2000);
          }
        });
      }
      return;
    }

    // ENSURE BOT IS ACTIVE FOR CHAT RESPONSES
    if (!checkActiveStatus(threadID) || senderID === currentBotID || !tData) return;

    // 2. LOCK GC NAME PROTECTION
    if (logMessageType === "log:thread-name") {
      const enforceTitle = tData.lockedGCName;
      if (enforceTitle && logMessageData && logMessageData.name !== enforceTitle) {
        setTimeout(() => {
          try {
            api.setTitle(enforceTitle, threadID, (err) => {
              if (!err) {
                dispatchSilentTagReply(api, threadID, `⚡ @silent *Prince Drake:* Wag mong galawin ang pangalan ng Arena! Naka-lock ito sa "${enforceTitle}".`, null);
              }
            });
          } catch (e) {}
        }, 1200);
      }
      return;
    }

    if (body && body.startsWith("/")) return;

    // 3. TARGET USER FILTER
    if (tData.singleTarget && senderID !== tData.singleTarget) {
      return;
    }

    // 4. SPAM FILTER
    if (detectSpammer(senderID)) return;

    // 5. 3-SECOND COOLDOWN GUARD
    const nowTime = Date.now();
    if (cooldownTracker[threadID] && (nowTime - cooldownTracker[threadID] < REPLY_INTERVAL)) {
      return;
    }

    let finalRoast = "";
    const hasSticker = type === "sticker" || (attachments && Array.isArray(attachments) && attachments.some(a => a.type === "sticker"));
    
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F7FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const isPureEmoji = body && body.trim().replace(emojiRegex, '').length === 0;

    if (hasSticker) {
      finalRoast = DRAKE_STICKER_ROASTS[Math.floor(Math.random() * DRAKE_STICKER_ROASTS.length)];
    } else if (isPureEmoji) {
      finalRoast = DRAKE_EMOJI_ROASTS[Math.floor(Math.random() * DRAKE_EMOJI_ROASTS.length)];
    } else {
      finalRoast = DRAKE_TEXT_ROASTS[Math.floor(Math.random() * DRAKE_TEXT_ROASTS.length)];
    }

    if (!finalRoast || finalRoast.trim().length === 0) return;

    cooldownTracker[threadID] = nowTime;

    const randomFooter = DRAKE_FOOTERS[Math.floor(Math.random() * DRAKE_FOOTERS.length)];
    const messageContent = finalRoast + randomFooter;

    // REACT DOG TO USER CHAT
    setTimeout(() => {
      try {
        api.setMessageReaction("🐶", messageID, () => {}, true);
      } catch (e) {}
    }, 300);

    // DELAYED REPLY (3s) + REACT TO OWN MESSAGE
    setTimeout(() => {
      dispatchSilentTagReply(api, threadID, messageContent, messageID, (err, msgInfo) => {
        if (!err && msgInfo && msgInfo.messageID) {
          const randomEnergyEmoji = DRAKE_SELF_REACTIONS[Math.floor(Math.random() * DRAKE_SELF_REACTIONS.length)];
          setTimeout(() => {
            try {
              api.setMessageReaction(randomEnergyEmoji, msgInfo.messageID, () => {}, true);
            } catch (e) {}
          }, 700);
        }
      });
    }, REPLY_INTERVAL);

  } catch (err) {}
};

// ===== COMMAND RUNNER =====
module.exports.run = async function ({ api, event, args }) {
  try {
    const { threadID, messageID, senderID, mentions } = event;
    const action = (args[0] || "").toLowerCase();
    const db = fetchDatabase();

    if (!db.threads) db.threads = {};
    if (!db.threads[threadID]) {
      db.threads[threadID] = { 
        expiry: 0, 
        singleTarget: null, 
        lockedGCName: null, 
        autoNick: null,
        welcomeOn: true 
      };
    }

    const threadObj = db.threads[threadID];

    // STRICT SINGLE OWNER GUARD (DRAKE ONLY: 61593899944181)
    if (senderID !== DRAKE_OWNER_ID) {
      return api.sendMessage("⚡ *Prince Drake:* Hindi ikaw ang may-hawak ng aking Power Level. Kay Drake lang ako sumusunod!", threadID, messageID);
    }

    // COMMAND: SET NICKNAMES
    if (action === "setnick") {
      const nicknameInput = args.slice(1).join(" ");
      if (!nicknameInput) return api.sendMessage("⚡ *Prince Drake:* Ilagay mo ang nickname. Usage: /drake setnick <nickname>", threadID, messageID);

      threadObj.autoNick = nicknameInput;
      persistDatabase(db);

      batchRenameMembers(api, threadID, nicknameInput);
      return api.sendMessage(`⚡ *Prince Drake:* Pinalitan ko na ang nickname ng lahat sa "${nicknameInput}".`, threadID, messageID);
    }

    // COMMAND: LOCK GC NAME
    if (action === "lockname") {
      const gnameInput = args.slice(1).join(" ");
      if (!gnameInput) return api.sendMessage("⚡ *Prince Drake:* Ilagay mo ang ilo-lock na pangalan. Usage: /drake lockname <pangalan>", threadID, messageID);

      threadObj.lockedGCName = gnameInput;
      persistDatabase(db);

      api.setTitle(gnameInput, threadID, (err) => {
        if (err) return api.sendMessage("⚠️ Hindi maipasa ang utos. Siguraduhing admin ang bot sa GC na 'to.", threadID, messageID);
        return api.sendMessage(`⚡ *Prince Drake:* Naka-lock na ang Arena Name sa "${gnameInput}".`, threadID, messageID);
      });
      return;
    }

    // COMMAND: WELCOME TOGGLE
    if (action === "welcome") {
      const opt = (args[1] || "").toLowerCase();
      if (opt === "on") {
        threadObj.welcomeOn = true;
        persistDatabase(db);
        return api.sendMessage("⚡ *Prince Drake:* Welcome system: ENABLED.", threadID, messageID);
      } else if (opt === "off") {
        threadObj.welcomeOn = false;
        persistDatabase(db);
        return api.sendMessage("⚡ *Prince Drake:* Welcome system: DISABLED.", threadID, messageID);
      }
      return api.sendMessage("⚡ *Prince Drake:* Use: /drake welcome on O /drake welcome off", threadID, messageID);
    }

    // MAIN ACTIVATION COMMAND
    if (action === "on") {
      const duration = Date.now() + 24 * 60 * 60 * 1000;
      threadObj.expiry = duration;
      persistDatabase(db);

      return api.sendMessage(
        `🐉 DRAKE ENGINE: SAIYAN POWER ACTIVATED ⚡\n\n` +
        `👑 Exclusive Master: ${DRAKE_OWNER_ID}\n` +
        `🤖 Persona: Prince Drake Saiyan Mode\n` +
        `🔕 Silent Tag: Enabled (@silent / silent notify)\n` +
        `🐶 User Reaction: Dog (🐶) sa chat ng user\n` +
        `⚡ Self Reaction: Energy Emojis (⚡🔥💥🐉🌀) sa sariling chat\n` +
        `💬 Delay: 1 Message = 1 Reply (Exact 3-Second Delay)\n` +
        `📌 Locked Title: ${threadObj.lockedGCName ? threadObj.lockedGCName : "Disabled"}\n` +
        `👋 Welcome Mode: ${threadObj.welcomeOn ? "ON" : "OFF"}\n` +
        `🎯 Target User: ${threadObj.singleTarget ? "Active" : "Lahat ng warriors"}\n` +
        `⏳ Duration: 24 Hours Active Arena`,
        threadID,
        messageID
      );
    }

    if (action === "target") {
      const mentionKeys = mentions ? Object.keys(mentions) : [];
      if (mentionKeys.length === 0 && !args[1]) {
        return api.sendMessage("⚡ *Prince Drake:* Mag-tag ka ng target. Usage: /drake target @mention", threadID, messageID);
      }

      const tUser = mentionKeys[0] || args[1];
      threadObj.singleTarget = tUser;
      persistDatabase(db);

      return api.sendMessage(`⚡ *Prince Drake:* Si <@${tUser}> na lang ang kakausapin at aasarin ko sa laban.`, threadID, messageID, {
        mentions: [{ tag: `<@${tUser}>`, id: tUser }]
      });
    }

    if (action === "untarget") {
      threadObj.singleTarget = null;
      persistDatabase(db);
      return api.sendMessage("⚡ *Prince Drake:* Inalis ko na ang target. Lahat kayo pwedeng harapin.", threadID, messageID);
    }

    if (action === "off") {
      if (checkActiveStatus(threadID)) {
        threadObj.expiry = 0;
        threadObj.singleTarget = null;
        persistDatabase(db);
        return api.sendMessage("⚡ *Prince Drake:* Isinara ko na ang Saiyan Arena sa GC na 'to.", threadID, messageID);
      }
      return api.sendMessage("⚡ *Prince Drake:* Naka-off na ang bot.", threadID, messageID);
    }

    if (action === "status") {
      const leftTime = fetchRemainingTime(threadID);
      if (leftTime <= 0) return api.sendMessage("⚡ *Prince Drake:* Naka-OFF ang bot sa GC na 'to.", threadID, messageID);

      const hrs = Math.floor(leftTime / (1000 * 60 * 60));
      const mins = Math.floor((leftTime % (1000 * 60 * 60)) / (1000 * 60));
      return api.sendMessage(
        `🐉 DRAKE ENGINE STATUS:\n` +
        `• Time Remaining: ${hrs}h ${mins}m\n` +
        `• Master Admin: ${DRAKE_OWNER_ID}\n` +
        `• Mode: Saiyan Power Mode\n` +
        `• Silent Mention: Active (@silent)\n` +
        `• Delay: Exact 3 Seconds\n` +
        `• Locked Name: ${threadObj.lockedGCName ? threadObj.lockedGCName : "None"}\n` +
        `• Auto Welcome: ${threadObj.welcomeOn ? "ON" : "OFF"}\n` +
        `• Targeted User: ${threadObj.singleTarget ? threadObj.singleTarget : "Lahat sa GC"}`,
        threadID,
        messageID
      );
    }

    return api.sendMessage(
      `🐉 Drake Engine Commands (Owner: ${DRAKE_OWNER_ID}):\n` +
      `/drake on — Power Up 24h Saiyan Engine\n` +
      `/drake lockname <pangalan> — Set and lock GC title\n` +
      `/drake setnick <nickname> — Change nicknames\n` +
      `/drake welcome <on/off> — Auto welcome toggle\n` +
      `/drake target @mention — Target specific user\n` +
      `/drake untarget — Remove target\n` +
      `/drake off — Power down engine\n` +
      `/drake status — View Engine stats`,
      threadID,
      messageID
    );
  } catch (err) {}
};
