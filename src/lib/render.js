import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';

const TEMPLATE_PATH = path.join(process.cwd(), 'src', 'templates', 'base.hbs');

export async function renderNewsletter(data){
  const tpl = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const template = Handlebars.compile(tpl);
  return template(data);
}
