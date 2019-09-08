const fs = require('fs');
const path = require('path');
const pug = require('pug');

for (let filename of fs.readdirSync('./views/fragments')) {
  if (filename.endsWith('.swp')) {
    continue;
  }
  fs.mkdirSync(path.join('./static', 'fragments'), { recursive: true });
  let src_path = path.join('./views', 'fragments', filename);
  let dest_path = path.join('./static', 'fragments',
      filename.replace('.pug', '.js'));

  let fn_string = pug.compileFileClient(
    src_path, {name: path.basename(src_path, '.pug')});

  fs.writeFileSync(dest_path, fn_string);
}
