// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
export default function init(runtime) {
    'use strict';

    const INSTANCE_KEY = '__spicyChatEmojiPickerV1';
    if (window[INSTANCE_KEY]) return;
    window[INSTANCE_KEY] = true;

    const TEXTAREA_SELECTOR = 'textarea[placeholder="Message..."]';
    const NATIVE_ACTION_SELECTOR = 'button[aria-label="record-voice"], button[aria-label="send-message"]';
    const STORAGE_KEY = 'tm-spicychat-emoji-picker-state-v1';
    const STYLE_ID = 'tm-sc-emoji-picker-style';
    const TRIGGER_WRAP_ID = 'tm-sc-emoji-trigger-wrap';
    const PICKER_ID = 'tm-sc-emoji-picker';
    const MAX_RECENT = 64;
    const MAX_USAGE_ENTRIES = 300;

    const emojiList = (value) => value.trim().split(/\s+/u);

    const EMOJIS = {
        faces: emojiList(`
            😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋
            😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 🙂‍↕️ 😏 😒 🙂‍↔️ 😞 😔 😟 😕 🙁 ☹️ 😣 😖
            😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫢 🫡
            🤫 🫠 🤥 😶 😶‍🌫️ 😐 😑 😬 🫨 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 😵‍💫 🥴 🤐
            🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 🤡 💩 👻 💀 ☠️ 👽 👾 🤖 🎃 😺 😸 😹
            😻 😼 😽 🙀 😿 😾 🫶 🥹 🫥 🫤 🥱 🤓 🥸 😎 🤩 🥳 😇 😈 😏 🥵 😳 🥺 😭
            🙈 🙉 🙊 💋 💌 💘 💝 💖 💗 💓 💞 💕 💟 ❣️ ❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🤎
            🖤 🩶 🤍 ❤️‍🔥 ❤️‍🩹 💔 ♥️ 💯 💢 💥 💫 💦 💨 🕳️ 💬 👁️‍🗨️ 🗨️ 🗯️ 💭 💤
        `),
        people: emojiList(`
            👋 🤚 🖐️ ✋ 🖖 🫱 🫲 🫳 🫴 🫷 🫸 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉
            👆 🖕 👇 ☝️ 🫵 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾
            🦿 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 🫦 💋 🩸 👶 🧒 👦 👧
            🧑 👱 👨 🧔 🧔‍♂️ 🧔‍♀️ 👩 🧓 👴 👵 👲 👳‍♂️ 👳‍♀️ 🧕 👮‍♂️ 👮‍♀️ 👷‍♂️ 👷‍♀️
            💂‍♂️ 💂‍♀️ 🕵️‍♂️ 🕵️‍♀️ 👩‍⚕️ 👨‍⚕️ 👩‍🌾 👨‍🌾 👩‍🍳 👨‍🍳 👩‍🎓 👨‍🎓 👩‍🎤 👨‍🎤
            👩‍🏫 👨‍🏫 👩‍🏭 👨‍🏭 👩‍💻 👨‍💻 👩‍💼 👨‍💼 👩‍🔧 👨‍🔧 👩‍🔬 👨‍🔬 👩‍🎨 👨‍🎨
            👩‍🚒 👨‍🚒 👩‍✈️ 👨‍✈️ 👩‍🚀 👨‍🚀 👩‍⚖️ 👨‍⚖️ 👰‍♀️ 👰‍♂️ 🤵‍♀️ 🤵‍♂️ 👸 🤴
            🥷 🦸‍♀️ 🦸‍♂️ 🦹‍♀️ 🦹‍♂️ 🤶 🎅 🧙‍♀️ 🧙‍♂️ 🧝‍♀️ 🧝‍♂️ 🧛‍♀️ 🧛‍♂️ 🧟‍♀️ 🧟‍♂️
            🧞‍♀️ 🧞‍♂️ 🧜‍♀️ 🧜‍♂️ 🧚‍♀️ 🧚‍♂️ 👼 🤰 🫃 🫄 🤱 👩‍🍼 👨‍🍼 🙇‍♀️ 🙇‍♂️
            💁‍♀️ 💁‍♂️ 🙅‍♀️ 🙅‍♂️ 🙆‍♀️ 🙆‍♂️ 🙋‍♀️ 🙋‍♂️ 🧏‍♀️ 🧏‍♂️ 🤦‍♀️ 🤦‍♂️ 🤷‍♀️ 🤷‍♂️
            🙎‍♀️ 🙎‍♂️ 🙍‍♀️ 🙍‍♂️ 💇‍♀️ 💇‍♂️ 💆‍♀️ 💆‍♂️ 🧖‍♀️ 🧖‍♂️ 💃 🕺 👯‍♀️ 👯‍♂️
            🕴️ 👩‍🦽 👨‍🦽 👩‍🦼 👨‍🦼 🚶‍♀️ 🚶‍♂️ 👩‍🦯 👨‍🦯 🧎‍♀️ 🧎‍♂️ 🏃‍♀️ 🏃‍♂️
            🧍‍♀️ 🧍‍♂️ 👭 👫 👬 🧑‍🤝‍🧑 💏 👩‍❤️‍💋‍👨 👨‍❤️‍💋‍👨 👩‍❤️‍💋‍👩 💑 👩‍❤️‍👨
            👨‍❤️‍👨 👩‍❤️‍👩 👪 👨‍👩‍👧 👨‍👩‍👧‍👦 👨‍👩‍👦‍👦 👨‍👩‍👧‍👧 👩‍👩‍👦 👨‍👨‍👧
        `),
        animals: emojiList(`
            🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐽 🐸 🐵 🙈 🙉 🙊
            🐒 🐔 🐧 🐦 🐤 🐣 🐥 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🫎 🫏 🐝 🪱 🐛 🦋
            🐌 🪲 🐞 🦗 🪳 🕷️ 🕸️ 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🪼 🦐 🦞 🦀 🐡 🐠
            🐟 🐬 🐳 🐋 🦈 🦭 🐊 🐅 🐆 🦓 🦍 🦧 🦣 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🦬
            🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🦮 🐕‍🦺 🐈 🐈‍⬛ 🪽 🪶 🐓 🦃
            🦤 🦚 🦜 🦢 🪿 🦩 🕊️ 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿️ 🦔 🐾 🐉 🐲
            🌵 🎄 🌲 🌳 🌴 🪹 🪺 🪵 🌱 🌿 ☘️ 🍀 🎍 🪴 🎋 🍃 🍂 🍁 🍄 🐚 🪸 🪨
            🌾 💐 🌷 🪷 🌹 🥀 🌺 🌸 🪻 🌼 🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌖 🌗 🌘 🌑
            🌒 🌓 🌔 🌙 🌎 🌍 🌏 🪐 💫 ⭐ 🌟 ✨ ⚡ ☄️ 💥 🔥 🌪️ 🌈 ☀️ 🌤️ ⛅
            🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 💧 💦 ☔ ☂️ 🌊 🌫️
        `),
        food: emojiList(`
            🍏 🍎 🍐 🍊 🍋 🍋‍🟩 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆
            🥑 🫛 🥦 🥬 🥒 🌶️ 🫑 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🫚 🫘 🌰 🥜 🍄‍🟫
            🍞 🥐 🥖 🫓 🥨 🥯 🥞 🧇 🧀 🍖 🍗 🥩 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯
            🫔 🥙 🧆 🥚 🍳 🥘 🍲 🫕 🥣 🥗 🍿 🧈 🧂 🥫 🍱 🍘 🍙 🍚 🍛 🍜
            🍝 🍢 🍣 🍤 🍥 🥮 🍡 🥟 🥠 🥡 🦪 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🥧 🍫
            🍬 🍭 🍮 🍯 🍼 🥛 ☕ 🫖 🍵 🍶 🍾 🍷 🍸 🍹 🍺 🍻 🥂 🥃 🫗 🥤 🧋
            🧃 🧉 🧊 🥢 🍽️ 🍴 🥄 🔪 🫙 🏺 🍒 🍑 🍆 🌭 💦 😋 🤤 🥵
        `),
        activities: emojiList(`
            ⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳
            🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏋️‍♀️ 🏋️‍♂️
            🤼‍♀️ 🤼‍♂️ 🤸‍♀️ 🤸‍♂️ ⛹️‍♀️ ⛹️‍♂️ 🤺 🤾‍♀️ 🤾‍♂️ 🏌️‍♀️ 🏌️‍♂️ 🏇 🧘‍♀️ 🧘‍♂️
            🏄‍♀️ 🏄‍♂️ 🏊‍♀️ 🏊‍♂️ 🤽‍♀️ 🤽‍♂️ 🚣‍♀️ 🚣‍♂️ 🧗‍♀️ 🧗‍♂️ 🚵‍♀️ 🚵‍♂️ 🚴‍♀️ 🚴‍♂️
            🏆 🥇 🥈 🥉 🏅 🎖️ 🏵️ 🎗️ 🎫 🎟️ 🎪 🤹‍♀️ 🤹‍♂️ 🎭 🩰 🎨 🎬 🎤
            🎧 🎼 🎹 🪗 🥁 🪘 🎷 🎺 🪈 🎸 🪕 🎻 🪇 🎲 ♟️ 🎯 🎳 🎮 🕹️ 🎰
            🧩 🧸 🪅 🪩 🪆 ♠️ ♥️ ♦️ ♣️ 🃏 🀄 🎴 🔮 🪄 🧿 🎱 🎉 🎊 🎈 🎁
            🎀 🪄 ✨ 🎆 🎇 🧨 🎄 🎃 🎗️ 🎟️ 🎫 🏟️ 🏖️ 🏕️
        `),
        travel: emojiList(`
            🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🦽 🦼 🛴 🚲 🛵 🏍️
            🛺 🚨 🚔 🚍 🚘 🚖 🛞 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇
            🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓
            🛟 🪝 ⛽ 🚧 🚦 🚥 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🛝 🎠 ⛲ ⛱️
            🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🛖 🏠 🏡 🏘️ 🏚️ 🏗️ 🏭 🏢 🏬
            🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛️ ⛪ 🕌 🕍 🛕 🕋 ⛩️ 🛤️ 🛣️ 🗾
            🎑 🏞️ 🌅 🌄 🌠 🎇 🎆 🌇 🌆 🏙️ 🌃 🌌 🌉 🌁 ⌚ 📱 💻 🧭 🧳 🌍
        `),
        objects: emojiList(`
            ⌚ 📱 📲 💻 ⌨️ 🖥️ 🖨️ 🖱️ 🖲️ 🕹️ 🗜️ 💽 💾 💿 📀 📼 📷 📸
            📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ 🧭 ⏱️ ⏲️ ⏰ 🕰️
            ⌛ ⏳ 📡 🔋 🪫 🔌 💡 🔦 🕯️ 🪔 🧯 🛢️ 💸 💵 💴 💶 💷 🪙 💰 💳
            💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒️ 🛠️ ⛏️ 🪚 🔩 ⚙️ 🪤 🧱 ⛓️ ⛓️‍💥 🧲 🔫
            💣 🧨 🪓 🔪 🗡️ ⚔️ 🛡️ 🚬 ⚰️ 🪦 ⚱️ 🏺 🔮 📿 🧿 🪬 💈 ⚗️ 🔭 🔬
            🕳️ 🩹 🩺 🩻 🩼 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡️ 🧹 🪠 🧺 🧻 🚽 🚿
            🛁 🛀 🪥 🪒 🧼 🫧 🪮 🧽 🪣 🧴 🛎️ 🔑 🗝️ 🚪 🪑 🛋️ 🛏️ 🛌 🧸
            🪞 🪟 🛍️ 🛒 🎁 🎈 🎏 🎀 🪄 🪅 🎊 🎉 🪩 🪆 🖼️ 🧵 🪡 🧶 🪢 👓
            🕶️ 🥽 🥼 🦺 👔 👕 👖 🧣 🧤 🧥 🧦 👗 👘 🥻 🩱 🩲 🩳 👙 👚
            🪭 👛 👜 👝 🛍️ 🎒 🩴 👞 👟 🥾 🥿 👠 👡 🩰 👢 🪮 👑 👒 🎩 🎓
            🧢 🪖 ⛑️ 💄 💍 💼 📁 📂 🗂️ 🗃️ 🗄️ 📊 📈 📉 📋 📌 📍 📎 🖇️
            📏 📐 ✂️ 🗑️ 📝 ✏️ 🖊️ 🖋️ 🖌️ 🖍️ 📚 📖 🔖 🧷 🔐 🔒 🔓 🗒️ 📄
            📃 📜 📑 🧾 ✉️ 📧 📨 📩 📤 📥 📦 📫 📪 📬 📭 📮 🗳️
        `),
        symbols: emojiList(`
            ❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🤎 🖤 🩶 🤍 💔 ❤️‍🔥 ❤️‍🩹 ❣️ 💕 💞 💓
            💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉
            ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚 🈸 🈺
            🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕
            🛑 ⛔ 📛 🚫 💯 💢 ♨️ 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❗ ❕ ❓ ❔ ‼️ ⁉️
            🔅 🔆 〽️ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 🈯 💹 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 💤
            🏧 🚾 ♿ 🅿️ 🛗 🈳 🈂️ 🛂 🛃 🛄 🛅 🚹 🚺 🚼 ⚧️ 🚻 🚮 🎦 📶
            🈁 🔣 ℹ️ 🔤 🔡 🔠 🆖 🆗 🆙 🆒 🆕 🆓 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣
            6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔢 #️⃣ *️⃣ ⏏️ ▶️ ⏸️ ⏯️ ⏹️ ⏺️ ⏭️ ⏮️ ⏩ ⏪
            ⏫ ⏬ ◀️ 🔼 🔽 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ ↪️ ↩️ ⤴️ ⤵️
            🔀 🔁 🔂 🔄 🔃 🎵 🎶 ➕ ➖ ➗ ✖️ 🟰 ♾️ 💲 💱 ™️ ©️ ®️ 〰️ ➰
            ➿ 🔚 🔙 🔛 🔝 🔜 ✔️ ☑️ 🔘 🔴 🟠 🟡 🟢 🔵 🟣 🟤 ⚫ ⚪ 🟥 🟧
            🟨 🟩 🟦 🟪 🟫 ⬛ ⬜ ◼️ ◻️ ◾ ◽ ▪️ ▫️ 🔸 🔹 🔶 🔷 🔺 🔻 💠
            🔳 🔲 🧿 👁️‍🗨️ 💬 🗨️ 🗯️ 💭 💤 ♠️ ♥️ ♦️ ♣️ 🃏
        `),
        flags: emojiList(`
            🏁 🚩 🎌 🏴 🏳️ 🏳️‍🌈 🏳️‍⚧️ 🏴‍☠️ 🇺🇳 🇦🇫 🇦🇱 🇩🇿 🇦🇸 🇦🇩 🇦🇴 🇦🇮
            🇦🇶 🇦🇬 🇦🇷 🇦🇲 🇦🇼 🇦🇺 🇦🇹 🇦🇿 🇧🇸 🇧🇭 🇧🇩 🇧🇧 🇧🇾 🇧🇪 🇧🇿 🇧🇯
            🇧🇲 🇧🇹 🇧🇴 🇧🇦 🇧🇼 🇧🇷 🇧🇳 🇧🇬 🇧🇫 🇧🇮 🇰🇭 🇨🇲 🇨🇦 🇨🇻 🇨🇫 🇹🇩
            🇨🇱 🇨🇳 🇨🇴 🇰🇲 🇨🇬 🇨🇩 🇨🇷 🇨🇮 🇭🇷 🇨🇺 🇨🇾 🇨🇿 🇩🇰 🇩🇯 🇩🇲 🇩🇴
            🇪🇨 🇪🇬 🇸🇻 🇬🇶 🇪🇷 🇪🇪 🇸🇿 🇪🇹 🇪🇺 🇫🇯 🇫🇮 🇫🇷 🇬🇦 🇬🇲 🇬🇪 🇩🇪
            🇬🇭 🇬🇷 🇬🇩 🇬🇹 🇬🇳 🇬🇼 🇬🇾 🇭🇹 🇭🇳 🇭🇰 🇭🇺 🇮🇸 🇮🇳 🇮🇩 🇮🇷 🇮🇶
            🇮🇪 🇮🇱 🇮🇹 🇯🇲 🇯🇵 🇯🇴 🇰🇿 🇰🇪 🇰🇮 🇰🇵 🇰🇷 🇽🇰 🇰🇼 🇰🇬 🇱🇦 🇱🇻
            🇱🇧 🇱🇸 🇱🇷 🇱🇾 🇱🇮 🇱🇹 🇱🇺 🇲🇬 🇲🇼 🇲🇾 🇲🇻 🇲🇱 🇲🇹 🇲🇭 🇲🇷 🇲🇺
            🇲🇽 🇫🇲 🇲🇩 🇲🇨 🇲🇳 🇲🇪 🇲🇦 🇲🇿 🇲🇲 🇳🇦 🇳🇷 🇳🇵 🇳🇱 🇳🇿 🇳🇮 🇳🇪
            🇳🇬 🇲🇰 🇳🇴 🇴🇲 🇵🇰 🇵🇼 🇵🇸 🇵🇦 🇵🇬 🇵🇾 🇵🇪 🇵🇭 🇵🇱 🇵🇹 🇶🇦 🇷🇴
            🇷🇺 🇷🇼 🇼🇸 🇸🇲 🇸🇦 🇸🇳 🇷🇸 🇸🇨 🇸🇱 🇸🇬 🇸🇰 🇸🇮 🇸🇧 🇸🇴 🇿🇦 🇸🇸
            🇪🇸 🇱🇰 🇸🇩 🇸🇷 🇸🇪 🇨🇭 🇸🇾 🇹🇼 🇹🇯 🇹🇿 🇹🇭 🇹🇱 🇹🇬 🇹🇴 🇹🇹 🇹🇳
            🇹🇷 🇹🇲 🇹🇻 🇺🇬 🇺🇦 🇦🇪 🇬🇧 🇺🇸 🇺🇾 🇺🇿 🇻🇺 🇻🇦 🇻🇪 🇻🇳 🇾🇪 🇿🇲
            🇿🇼 🏴 🏴 🏴
        `),
    };

    const DEFAULT_RECENT = emojiList(`
        😂 🤣 ❤️ 🥰 😍 😘 😉 😊 😏 😈 🥵 😳 🥺 😭 😅 🤭 🙈 🫶 👍 👀 💋
        🔥 ✨ 💦 💕 💔 😒 🙄 🤔 😴 💀 🤡 😎 🥳 😡 🤬 😱 😌 😋 🤤 🍑 🍆
    `);

    const CATEGORIES = [
        { id: 'recent', icon: '🕘', label: 'Недавние' },
        { id: 'frequent', icon: '🔥', label: 'Частые' },
        { id: 'faces', icon: '😀', label: 'Смайлы и эмоции' },
        { id: 'people', icon: '👋', label: 'Люди и жесты' },
        { id: 'animals', icon: '🐻', label: 'Животные и природа' },
        { id: 'food', icon: '🍕', label: 'Еда и напитки' },
        { id: 'activities', icon: '⚽', label: 'Занятия и развлечения' },
        { id: 'travel', icon: '🚗', label: 'Места и транспорт' },
        { id: 'objects', icon: '💡', label: 'Предметы' },
        { id: 'symbols', icon: '❤️', label: 'Символы' },
        { id: 'flags', icon: '🏳️', label: 'Флаги' },
    ];

    const validCategoryIds = new Set(CATEGORIES.map((category) => category.id));
    let state = loadState();
    let activeCategory = validCategoryIds.has(state.lastCategory) ? state.lastCategory : 'recent';
    let activeTextarea = null;
    let triggerButton = null;
    let picker = null;
    let categoryTabs = null;
    let categoryTitle = null;
    let emojiGrid = null;
    let ensureScheduled = false;
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;

    function loadState() {
        const fallback = { recent: [], usage: {}, lastCategory: 'recent' };
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!parsed || typeof parsed !== 'object') return fallback;
            return {
                recent: Array.isArray(parsed.recent)
                    ? parsed.recent.filter((item) => typeof item === 'string').slice(0, MAX_RECENT)
                    : [],
                usage: parsed.usage && typeof parsed.usage === 'object' ? parsed.usage : {},
                lastCategory: typeof parsed.lastCategory === 'string' ? parsed.lastCategory : 'recent',
            };
        } catch (_error) {
            return fallback;
        }
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (_error) {
            // Если localStorage недоступен, сам пикер всё равно продолжит работать.
        }
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const css = `
            #${TRIGGER_WRAP_ID} {
                display: flex !important;
                flex: 0 0 auto !important;
                order: 999 !important;
                align-items: flex-end !important;
                align-self: flex-end !important;
                margin-bottom: 4px !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger {
                appearance: none !important;
                box-sizing: border-box !important;
                width: 36px !important;
                height: 36px !important;
                min-width: 36px !important;
                padding: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                position: relative !important;
                overflow: visible !important;
                color: rgba(255, 255, 255, 0.9) !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 9999px !important;
                cursor: pointer !important;
                line-height: 1 !important;
                transition: background-color 120ms ease, color 120ms ease, transform 120ms ease !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger:hover,
            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[aria-expanded="true"] {
                color: #ffffff !important;
                background: rgba(255, 255, 255, 0.11) !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger:active {
                transform: scale(0.94) !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger:focus-visible {
                outline: 2px solid #1687f8 !important;
                outline-offset: 2px !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]::before,
            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]::after {
                position: absolute !important;
                left: 50% !important;
                z-index: 2147483647 !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                transition: opacity 120ms ease, transform 120ms ease, visibility 0s linear 120ms !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]::before {
                content: attr(data-tm-tooltip) !important;
                bottom: calc(100% + 13px) !important;
                padding: 10px 14px !important;
                color: #ffffff !important;
                background: #070707 !important;
                border: 1px solid rgba(255, 255, 255, 0.24) !important;
                border-radius: 11px !important;
                box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3) !important;
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
                font-size: 15px !important;
                font-weight: 500 !important;
                line-height: 1.2 !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
                white-space: nowrap !important;
                transform: translate(-50%, 4px) !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]::after {
                content: "" !important;
                bottom: calc(100% + 8px) !important;
                width: 10px !important;
                height: 10px !important;
                background: #070707 !important;
                border-right: 1px solid rgba(255, 255, 255, 0.24) !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.24) !important;
                transform: translate(-50%, 4px) rotate(45deg) !important;
            }

            @media (hover: hover) and (pointer: fine) {
                #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:hover::before,
                #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:hover::after {
                    opacity: 1 !important;
                    visibility: visible !important;
                    transition-delay: 320ms !important;
                }

                #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:hover::before {
                    transform: translate(-50%, 0) !important;
                }

                #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:hover::after {
                    transform: translate(-50%, 0) rotate(45deg) !important;
                }
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:focus-visible::before,
            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:focus-visible::after {
                opacity: 1 !important;
                visibility: visible !important;
                transition-delay: 0ms !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:focus-visible::before {
                transform: translate(-50%, 0) !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:focus-visible::after {
                transform: translate(-50%, 0) rotate(45deg) !important;
            }

            #${PICKER_ID} {
                position: fixed !important;
                z-index: 2147483647 !important;
                box-sizing: border-box !important;
                width: min(392px, calc(100vw - 20px)) !important;
                height: min(438px, calc(100vh - 92px)) !important;
                min-height: 280px !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                color: #f5f5f5 !important;
                color-scheme: dark !important;
                background: #1b1b1d !important;
                border: 1px solid rgba(255, 255, 255, 0.13) !important;
                border-radius: 16px !important;
                box-shadow: 0 18px 55px rgba(0, 0, 0, 0.58), 0 4px 14px rgba(0, 0, 0, 0.34) !important;
                font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
                user-select: none !important;
            }

            #${PICKER_ID}[hidden] {
                display: none !important;
            }

            #${PICKER_ID} .tm-sc-emoji-header {
                box-sizing: border-box !important;
                height: 52px !important;
                padding: 0 12px 0 16px !important;
                display: flex !important;
                flex: 0 0 auto !important;
                align-items: center !important;
                justify-content: space-between !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.09) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-title {
                min-width: 0 !important;
                overflow: hidden !important;
                color: #f5f5f5 !important;
                font-size: 14px !important;
                font-weight: 650 !important;
                line-height: 1.2 !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }

            #${PICKER_ID} .tm-sc-emoji-close {
                appearance: none !important;
                width: 32px !important;
                height: 32px !important;
                padding: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: rgba(255, 255, 255, 0.7) !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 9px !important;
                cursor: pointer !important;
                font: 25px/1 ui-sans-serif, system-ui, sans-serif !important;
            }

            #${PICKER_ID} .tm-sc-emoji-close:hover {
                color: #fff !important;
                background: rgba(255, 255, 255, 0.1) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-tabs {
                box-sizing: border-box !important;
                min-height: 51px !important;
                padding: 7px 8px 6px !important;
                display: flex !important;
                flex: 0 0 auto !important;
                gap: 3px !important;
                overflow-x: auto !important;
                overflow-y: hidden !important;
                scrollbar-width: none !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.07) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-tabs::-webkit-scrollbar {
                display: none !important;
            }

            #${PICKER_ID} .tm-sc-emoji-tab {
                appearance: none !important;
                box-sizing: border-box !important;
                width: 37px !important;
                height: 37px !important;
                min-width: 37px !important;
                padding: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 10px !important;
                cursor: pointer !important;
                font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif !important;
                font-size: 20px !important;
                line-height: 1 !important;
                transition: background-color 100ms ease, transform 100ms ease !important;
            }

            #${PICKER_ID} .tm-sc-emoji-tab:hover {
                background: rgba(255, 255, 255, 0.09) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-tab.is-active {
                background: rgba(22, 135, 248, 0.22) !important;
                box-shadow: inset 0 0 0 1px rgba(43, 148, 255, 0.46) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-tab:active {
                transform: scale(0.93) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-grid {
                box-sizing: border-box !important;
                padding: 10px 9px 13px !important;
                display: grid !important;
                flex: 1 1 auto !important;
                grid-template-columns: repeat(8, minmax(0, 1fr)) !important;
                grid-auto-rows: 42px !important;
                align-content: start !important;
                gap: 3px !important;
                overflow-x: hidden !important;
                overflow-y: auto !important;
                overscroll-behavior: contain !important;
                scrollbar-color: rgba(255, 255, 255, 0.24) transparent !important;
                scrollbar-width: thin !important;
            }

            #${PICKER_ID} .tm-sc-emoji-item {
                appearance: none !important;
                box-sizing: border-box !important;
                width: 100% !important;
                height: 42px !important;
                min-width: 0 !important;
                padding: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                overflow: visible !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 10px !important;
                cursor: pointer !important;
                font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif !important;
                font-size: 27px !important;
                line-height: 1 !important;
                transition: background-color 90ms ease, transform 90ms ease !important;
            }

            #${PICKER_ID} .tm-sc-emoji-item:hover {
                background: rgba(255, 255, 255, 0.11) !important;
                transform: scale(1.16) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-item:active {
                transform: scale(0.92) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-empty {
                grid-column: 1 / -1 !important;
                padding: 38px 18px !important;
                color: rgba(255, 255, 255, 0.55) !important;
                font-size: 13px !important;
                line-height: 1.45 !important;
                text-align: center !important;
            }

            @media (max-width: 520px) {
                #${PICKER_ID} .tm-sc-emoji-grid {
                    grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
                }
            }
        `;

        if (typeof GM_addStyle === 'function') {
            const style = GM_addStyle(css);
            if (style) style.id = STYLE_ID;
        } else {
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = css;
            document.head.appendChild(style);
        }
    }

    function isVisible(element) {
        if (!element || !element.isConnected) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0
            && rect.height > 0
            && style.display !== 'none'
            && style.visibility !== 'hidden';
    }

    function findTextarea() {
        const candidates = Array.from(document.querySelectorAll(TEXTAREA_SELECTOR)).filter(isVisible);
        return candidates.length ? candidates[candidates.length - 1] : null;
    }

    function findInputWrapper(textarea) {
        const wrapper = textarea.closest('div.w-full.flex');
        if (wrapper && wrapper.parentElement) return wrapper;

        let node = textarea.parentElement;
        for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
            if (node.parentElement && getComputedStyle(node.parentElement).display === 'flex') return node;
        }
        return null;
    }

    function getDirectRowChild(row, element) {
        let child = element;
        while (child && child.parentElement && child.parentElement !== row) {
            child = child.parentElement;
        }
        return child && child.parentElement === row ? child : null;
    }

    function hideNativeActionSlots(row) {
        const slots = new Set();
        for (const button of row.querySelectorAll(NATIVE_ACTION_SELECTOR)) {
            const slot = getDirectRowChild(row, button);
            if (slot) slots.add(slot);
        }

        for (const slot of slots) {
            slot.dataset.tmScEmojiHiddenNativeAction = 'true';
            slot.style.setProperty('display', 'none', 'important');
        }
    }

    function createTrigger() {
        const wrap = document.createElement('div');
        wrap.id = TRIGGER_WRAP_ID;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tm-sc-emoji-trigger';
        button.setAttribute('aria-label', 'Открыть эмодзи');
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-expanded', 'false');
        button.dataset.tmTooltip = 'Эмодзи';
        button.innerHTML = `
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                <path d="M9 9h.01"></path>
                <path d="M15 9h.01"></path>
            </svg>
        `;

        button.addEventListener('mousedown', (event) => {
            event.preventDefault();
        });

        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            togglePicker();
        });

        wrap.appendChild(button);
        triggerButton = button;
        return wrap;
    }

    function ensureTrigger() {
        ensureScheduled = false;
        const textarea = findTextarea();
        if (!textarea) return;

        const inputWrapper = findInputWrapper(textarea);
        const row = inputWrapper && inputWrapper.parentElement;
        if (!inputWrapper || !row) return;

        row.style.setProperty('column-gap', '0px', 'important');
        hideNativeActionSlots(row);

        const oldWrap = document.getElementById(TRIGGER_WRAP_ID);
        activeTextarea = textarea;

        if (oldWrap && oldWrap.parentElement === row && oldWrap.nextElementSibling === inputWrapper) {
            triggerButton = oldWrap.querySelector('.tm-sc-emoji-trigger');
            return;
        }

        if (oldWrap) oldWrap.remove();
        const wrap = createTrigger();
        row.insertBefore(wrap, inputWrapper);

        if (!picker) createPicker();
    }

    function scheduleEnsureTrigger() {
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(ensureDomFeatures);
    }

    function nodeContainsComposerFeature(node, includeDescendants = true) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        return (
            node.matches?.(TEXTAREA_SELECTOR)
            || node.id === TRIGGER_WRAP_ID
            || node.matches?.(NATIVE_ACTION_SELECTOR)
            || (includeDescendants && Boolean(node.querySelector?.(
                `${TEXTAREA_SELECTOR}, #${TRIGGER_WRAP_ID}, ${NATIVE_ACTION_SELECTOR}`,
            )))
        );
    }

    function handleRootMutations(records) {
        if (!records.length) {
            scheduleEnsureTrigger();
            return;
        }

        const activeComposerChanged = Boolean(activeTextarea && !activeTextarea.isConnected);
        const relevant = activeComposerChanged || records.some((record) => (
            nodeContainsComposerFeature(record.target, false)
            || Array.from(record.addedNodes).some((node) => nodeContainsComposerFeature(node, true))
            || Array.from(record.removedNodes).some((node) => nodeContainsComposerFeature(node, true))
        ));
        if (relevant) scheduleEnsureTrigger();
    }

    function createPicker() {
        picker = document.createElement('section');
        picker.id = PICKER_ID;
        picker.hidden = true;
        picker.setAttribute('role', 'dialog');
        picker.setAttribute('aria-label', 'Выбор эмодзи');

        const header = document.createElement('div');
        header.className = 'tm-sc-emoji-header';

        categoryTitle = document.createElement('div');
        categoryTitle.className = 'tm-sc-emoji-title';

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'tm-sc-emoji-close';
        closeButton.setAttribute('aria-label', 'Закрыть');
        closeButton.title = 'Закрыть';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', closePicker);

        header.append(categoryTitle, closeButton);

        categoryTabs = document.createElement('nav');
        categoryTabs.className = 'tm-sc-emoji-tabs';
        categoryTabs.setAttribute('aria-label', 'Категории эмодзи');

        for (const category of CATEGORIES) {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'tm-sc-emoji-tab';
            tab.dataset.category = category.id;
            tab.textContent = category.icon;
            tab.title = category.label;
            tab.setAttribute('aria-label', category.label);
            tab.addEventListener('mousedown', (event) => event.preventDefault());
            tab.addEventListener('click', () => setCategory(category.id));
            categoryTabs.appendChild(tab);
        }

        emojiGrid = document.createElement('div');
        emojiGrid.className = 'tm-sc-emoji-grid';
        emojiGrid.addEventListener('mousedown', (event) => {
            if (event.target.closest('.tm-sc-emoji-item')) event.preventDefault();
        });
        emojiGrid.addEventListener('click', (event) => {
            const item = event.target.closest('.tm-sc-emoji-item');
            if (!item) return;
            const emoji = item.dataset.emoji;
            if (!emoji) return;
            insertEmoji(emoji);
            rememberEmoji(emoji);
        });

        picker.append(header, categoryTabs, emojiGrid);
        document.body.appendChild(picker);
    }

    function getFrequentEmojis() {
        const recentIndex = new Map(state.recent.map((emoji, index) => [emoji, index]));
        const frequent = Object.entries(state.usage)
            .filter(([emoji, count]) => typeof emoji === 'string' && Number.isFinite(Number(count)))
            .sort((left, right) => {
                const countDifference = Number(right[1]) - Number(left[1]);
                if (countDifference) return countDifference;
                return (recentIndex.get(left[0]) ?? 9999) - (recentIndex.get(right[0]) ?? 9999);
            })
            .map(([emoji]) => emoji)
            .slice(0, MAX_RECENT);

        if (frequent.length >= 24) return frequent;
        const seen = new Set(frequent);
        for (const emoji of DEFAULT_RECENT) {
            if (!seen.has(emoji)) {
                frequent.push(emoji);
                seen.add(emoji);
            }
            if (frequent.length >= MAX_RECENT) break;
        }
        return frequent;
    }

    function getActiveEmojis() {
        if (activeCategory === 'recent') {
            return state.recent.length ? state.recent : DEFAULT_RECENT;
        }
        if (activeCategory === 'frequent') return getFrequentEmojis();
        return EMOJIS[activeCategory] || [];
    }

    function setCategory(categoryId) {
        if (!validCategoryIds.has(categoryId)) return;
        activeCategory = categoryId;
        state.lastCategory = categoryId;
        saveState();
        renderPicker();
    }

    function renderPicker() {
        if (!picker || !emojiGrid || !categoryTabs) return;

        const category = CATEGORIES.find((item) => item.id === activeCategory) || CATEGORIES[0];
        categoryTitle.textContent = category.label;

        for (const tab of categoryTabs.querySelectorAll('.tm-sc-emoji-tab')) {
            const selected = tab.dataset.category === activeCategory;
            tab.classList.toggle('is-active', selected);
            tab.setAttribute('aria-current', selected ? 'true' : 'false');
        }

        const emojis = getActiveEmojis();
        const fragment = document.createDocumentFragment();
        for (const emoji of emojis) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'tm-sc-emoji-item';
            button.dataset.emoji = emoji;
            button.textContent = emoji;
            button.setAttribute('aria-label', emoji);
            fragment.appendChild(button);
        }

        emojiGrid.replaceChildren(fragment);
        emojiGrid.scrollTop = 0;

        if (!emojis.length) {
            const empty = document.createElement('div');
            empty.className = 'tm-sc-emoji-empty';
            empty.textContent = 'Здесь пока пусто. Выбери несколько эмодзи в других категориях.';
            emojiGrid.appendChild(empty);
        }
    }

    function positionPicker() {
        if (!picker || picker.hidden || !triggerButton || !triggerButton.isConnected) return;

        const margin = 10;
        const gap = 10;
        const triggerRect = triggerButton.getBoundingClientRect();
        const pickerRect = picker.getBoundingClientRect();

        let left = triggerRect.left;
        let top = triggerRect.top - pickerRect.height - gap;

        left = Math.max(margin, Math.min(left, window.innerWidth - pickerRect.width - margin));
        if (top < margin) top = triggerRect.bottom + gap;
        top = Math.max(margin, Math.min(top, window.innerHeight - pickerRect.height - margin));

        picker.style.left = `${Math.round(left)}px`;
        picker.style.top = `${Math.round(top)}px`;
    }

    function openPicker() {
        if (!picker) createPicker();
        renderPicker();
        picker.hidden = false;
        if (triggerButton) triggerButton.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(positionPicker);
    }

    function closePicker() {
        if (!picker || picker.hidden) return;
        picker.hidden = true;
        if (triggerButton) triggerButton.setAttribute('aria-expanded', 'false');
    }

    function togglePicker() {
        if (!picker || picker.hidden) openPicker();
        else closePicker();
    }

    function setNativeTextareaValue(textarea, value) {
        const prototype = Object.getPrototypeOf(textarea);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        if (descriptor && descriptor.set) descriptor.set.call(textarea, value);
        else textarea.value = value;
    }

    function insertEmoji(emoji) {
        const textarea = isVisible(activeTextarea) ? activeTextarea : findTextarea();
        if (!textarea) return;

        const start = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : textarea.value.length;
        const end = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : start;
        const maxLength = textarea.maxLength > 0 ? textarea.maxLength : Infinity;
        const nextValue = textarea.value.slice(0, start) + emoji + textarea.value.slice(end);
        if (nextValue.length > maxLength) return;

        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(start, end);

        let insertedWithCommand = false;
        try {
            insertedWithCommand = document.execCommand('insertText', false, emoji);
        } catch (_error) {
            insertedWithCommand = false;
        }

        const nextCursorPosition = start + emoji.length;
        if (!insertedWithCommand || textarea.value !== nextValue) {
            setNativeTextareaValue(textarea, nextValue);
            const inputEvent = typeof InputEvent === 'function'
                ? new InputEvent('input', { bubbles: true, inputType: 'insertText', data: emoji })
                : new Event('input', { bubbles: true });
            textarea.dispatchEvent(inputEvent);
        }

        requestAnimationFrame(() => {
            if (!textarea.isConnected) return;
            textarea.focus({ preventScroll: true });
            textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
        });
    }

    function rememberEmoji(emoji) {
        state.recent = [emoji, ...state.recent.filter((item) => item !== emoji)].slice(0, MAX_RECENT);
        state.usage[emoji] = (Number(state.usage[emoji]) || 0) + 1;

        const usageEntries = Object.entries(state.usage);
        if (usageEntries.length > MAX_USAGE_ENTRIES) {
            usageEntries
                .sort((left, right) => Number(right[1]) - Number(left[1]))
                .slice(MAX_USAGE_ENTRIES)
                .forEach(([oldEmoji]) => delete state.usage[oldEmoji]);
        }

        saveState();
    }

    document.addEventListener('pointerdown', (event) => {
        if (!picker || picker.hidden) return;
        if (picker.contains(event.target) || (triggerButton && triggerButton.contains(event.target))) return;
        closePicker();
    }, true);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closePicker();
    });

    window.addEventListener('resize', positionPicker, { passive: true });
    window.addEventListener('scroll', (event) => {
        if (picker && !picker.hidden && !picker.contains(event.target)) positionPicker();
    }, { passive: true, capture: true });

    function scheduleRetry() {
        if (retryTimer) return;
        const delay = retryDelay;
        retryDelay = Math.min(8000, retryDelay * 2);
        retryTimer = window.setTimeout(() => {
            retryTimer = null;
            ensureDomFeatures();
        }, delay);
    }

    function resetRetry() {
        if (retryTimer) window.clearTimeout(retryTimer);
        retryTimer = null;
        retryDelay = 250;
    }

    function ensureDomFeatures() {
        ensureScheduled = false;
        if (!document.documentElement || !document.head || !document.body) return;

        try {
            addStyles();
            ensureTrigger();

            if (!rootObserver) {
                rootObserver = new MutationObserver(handleRootMutations);
                rootObserver.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['aria-label'],
                });
            }
            resetRetry();
        } catch (error) {
            rootObserver?.disconnect();
            rootObserver = null;
            console.error('[Emoji Picker] Инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
        }
    }

    ensureDomFeatures();

    window.addEventListener('pageshow', ensureDomFeatures);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) ensureDomFeatures();
    });
}
