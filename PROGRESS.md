# PROGRESS
Current task: Phone (Samsung SM_S911B, adb serial RZCX60GSX4K) me App Ideas login karna.
Done: Phone adb se connected; App (com.ky.appideas) already installed, latest site load karta hai (vercel). Login screen dikh rahi hai.
Next steps: User ID+password de ya PC pe Account/Login -> "Phone me login karo (QR)" scan kare. Login ke baad verify.
Key paths: android/build.sh, index.html (login ~line 1587, loginWithId ~5447), api/account.js
Open problems: ID/password mere paas nahi (secret, guess nahi karunga).
Last updated: 2026-11-12

## Task rows full-width text (2026-11-12)
Done: index.html todoRow me buttons ko `.todo-acts` me wrap kiya; PC pe hover overlay, touch pe alag line. sw.js cache v24. Pushed b1b8f3a.
Next: user refresh karke check kare; agar kuch off ho to CSS section "Text gets the full row width" (~line 692) tweak.

## Task row copy button (2026-11-13)
Done: todoRow me 📋 button (data-action copy-todo) — right-click pe dikhta hai (hover hataya, .acts-open class), text (+desc) clipboard me copy. sw.js cache v27.
