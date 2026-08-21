import puppeteer from 'puppeteer';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root = process.cwd();
const browser = await puppeteer.launch({headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
try {
  const page = await browser.newPage();
  await page.setViewport({width: 1080, height: 1920, deviceScaleFactor: 1});
  await page.goto(pathToFileURL(path.join(root, 'cover.html')).href, {waitUntil: 'networkidle0'});
  await page.evaluate(() => Promise.all([...document.images].map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => {img.onload = img.onerror = resolve;}))));
  await page.screenshot({path: path.join(root, 'deliverables', 'shane-front-squat-cover.png')});
  await page.screenshot({path: path.join(root, 'deliverables', 'shane-front-squat-cover-grid-check.png'), clip: {x: 0, y: 285, width: 1080, height: 1350}});
} finally {
  await browser.close();
}
