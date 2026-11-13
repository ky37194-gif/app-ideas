# PROGRESS
Current task: Phone (Samsung SM_S911B, adb serial RZCX60GSX4K) me App Ideas login karna.
Done: Phone adb se connected; App (com.ky.appideas) already installed, latest site load karta hai (vercel). Login screen dikh rahi hai.
Next steps: User ID+password de ya PC pe Account/Login -> "Phone me login karo (QR)" scan kare. Login ke baad verify.
Key paths: android/build.sh, index.html (login ~line 1587, loginWithId ~5447), api/account.js
Open problems: ID/password mere paas nahi (secret, guess nahi karunga).
Last updated: 2026-11-13

## Task rows full-width text (2026-11-12)
Done: index.html todoRow me buttons ko `.todo-acts` me wrap kiya; PC pe hover overlay, touch pe alag line. sw.js cache v24. Pushed b1b8f3a.
Next: user refresh karke check kare; agar kuch off ho to CSS section "Text gets the full row width" (~line 692) tweak.

## Task row copy button (2026-11-13)
Done: todoRow me 📋 button (data-action copy-todo) — right-click pe dikhta hai (hover hataya, .acts-open class), text (+desc) clipboard me copy. sw.js cache v27.

## Earning: groups, projects, features, quick ideas (2026-11-13)
Done: earnRegroup() one-time: cat-earn = 📱 Apps & Websites, new cat-dpa 🛍️ Digital Products & Affiliate (E-books, Notes, Pinterest, Digital Products, Affiliate moved in), cat-passion = 📣 Social Media.
Category page (child of a top group, not Social Media) = 🚀 Projects list + inline add (proj-form), no "naya page". Project page = ✨ Features (todo blocks), ☐ Feature jodo, ＋/Tab = sub-task (block.indent 0-4), photo paste.
Earning home: 💡 Jaldi likho (dump stored on cat-earn page .dump), ➜ bhejo = category→new project, project→feature. sw v28.
Next: user check kare live site pe.
NOTE: har deploy pe index.html me APP_VERSION bhi badlo (warna open app/PC tray app auto-reload nahi karta). 2026-11-13a set.
- 2026-11-13: Har category page (teeno groups, Social Media bhi) me 💡 Ideas section (page.dump). Idea click = sheet (title, desc, ☑ todo list, Item jodo, progress) — openIdeaSheet. 🚀 = idea → project (features saath). Category pages pe Yahan likho/Photo/Shortcut hint hide. Projects ab list: #1 bada "🎯 Current project" card, baaki chhoti rows (projectList). APP_VERSION 2026-11-13d, sw v29.
- 2026-11-13: proj-row hover pe '🎯 Set as current' (reorderPage before #1). APP_VERSION e, sw v30.
- 2026-11-13: Category page = 2 columns (💡 Ideas | 🚀 Projects). Projects: max 3 🎯 current (page.cur), ✅ Ban gaya (page.built) → neeche "Ban gaye" fold, ↩ Wapas. Rows me category ka icon. Project rows drag = sirf rank (data-no-into, andar nahi jata). Project editor: empty feature pe Enter = feature hi rehta, Feature jodo empty lines saaf karta. Social Media ko user baad me batayega (abhi untouched). APP_VERSION f, sw v31.
- Local test: scratchpad cdp.mjs + headless Edge (port 9333) + python http.server 8765.
- 2026-11-13: Dashboard = sirf 📊 Dashboard (Inbox alag page #/inbox, nav me alag item). Right column = har Earning section ke 🎯 current projects + open features (☐ tick, ＋ Feature likho). Fonts bade. "Abhi kar raha hoon" → "⚡ Current tasks". Project rows: right-click = 🎯 Set as current/✅ Ban gaya; project page pe bhi 🎯 button; row overflow fix. Social Media page = 📺 YT channel cards, channel page ke andar 📸 Instagram pages. #/feat = ✨ feature popup (Tab = agla project, Alt+1-9). PC app: Alt+F (fallback Ctrl+Shift+F) + tray item + --feat arg; repack karke AppData\Local\Programs\App Ideas\resources\app.asar replace kiya. Desktop: "Feature likho.lnk" (--feat, Ctrl+Alt+F). APP_VERSION g, sw v32.
- 2026-11-13: Dashboard se ⏭️ Up next box hataya (data safe, #/current pe hai). APP_VERSION h, sw v33.
- 2026-11-13: Dashboard pe saare current projects dikhte (2 ki limit / '▸ N aur projects' hataya). APP_VERSION i, sw v34.
- 2026-11-13: ⚡ Current tasks card ab Dashboard ke sabse upar (full width, .dash-top), neeche 2 columns. APP_VERSION j, sw v35.
