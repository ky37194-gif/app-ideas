// Wraps the site's 512px PNG icon into icon.ico (an .ico may hold a PNG directly).
const fs = require('fs');
const path = require('path');
const png = fs.readFileSync(path.join(__dirname, '..', 'icons', 'icon-512.png'));
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header.writeUInt8(0, 6); // width 256+ (0 = 256)
header.writeUInt8(0, 7); // height
header.writeUInt8(0, 8); // palette
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); // planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18); // data offset
fs.writeFileSync(path.join(__dirname, 'icon.ico'), Buffer.concat([header, png]));
fs.copyFileSync(path.join(__dirname, '..', 'icons', 'icon-192.png'), path.join(__dirname, 'icon.png'));
console.log('icon.ico ready');
