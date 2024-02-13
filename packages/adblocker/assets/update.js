const fs = require('fs');
const path = require('path');
const adb = require('@cliqz/adblocker');

const FILTER_LISTS = [
  ['ublock-unbreak', 'ublock-origin', 'unbreak.txt'],
  ['ublock-quick-fixes', 'ublock-origin', 'quick-fixes.txt'],
  ['ublock-filters', 'ublock-origin', 'filters.txt'],
  ['ublock-filters-2020', 'ublock-origin', 'filters-2020.txt'],
  ['ublock-filters-2021', 'ublock-origin', 'filters-2021.txt'],
  ['ublock-filters-2022', 'ublock-origin', 'filters-2022.txt'],
  ['ublock-filters-2023', 'ublock-origin', 'filters-2023.txt'],
  ['ublock-filters-2024', 'ublock-origin', 'filters-2024.txt'],
  ['ublock-badware', 'ublock-origin', 'badware.txt'],
  ['ublock-abuse', 'ublock-origin', 'resource-abuse.txt'],
  ['ublock-annoyances-others', 'ublock-origin', 'annoyances-others.txt'],
  ['ublock-annoyances-cookies', 'ublock-origin', 'annoyances-cookies.txt'],
  ['ublock-privacy', 'ublock-origin', 'privacy.txt'],
  ['plowe-0', 'peter-lowe', 'serverlist.txt'],
  ['easylist', 'easylist', 'easylist.txt'],
  ['easyprivacy', 'easylist', 'easyprivacy.txt'],
  ['easylist-cookie', 'easylist', 'easylist-cookie.txt'],
];

async function downloadResource(resourceName) {
  const { revisions } = await fetch(`https://cdn.ghostery.com/adblocker/resources/${resourceName}/metadata.json`).then(result => {
    if (!result.ok) {
      throw new Error(`Failed to fetch ${resourceName} metadata: ${result.status}: ${result.statusText}`);
    }
    return result.json();
  });
  return fetch(`https://cdn.ghostery.com/adblocker/resources/${resourceName}/${revisions.pop()}/list.txt`).then(result => {
    if (!result.ok) {
      throw new Error(`Failed to fetch ${resourceName}: ${result.status}: ${result.statusText}`);
    }
    return result.text();
  })
}

(async () => {
  // Update resources.txt
  fs.writeFileSync(
    path.join(__dirname, 'ublock-origin', 'resources.txt'),
    await downloadResource('ublock-resources'),
    'utf-8',
  );

  let duplicatesCount = 0;
  let badfiltersCount = 0;

  const badfilters = new Map();
  const seen = new Map();

  // Update lists
  for (const [resourceName, outputPrefixPath, outputFileName] of FILTER_LISTS) {
    console.log(`Fetching: ${resourceName}`);

    const lines = (await downloadResource(resourceName))
      .split(/[\r\n]/g)
      .map((line) => line.trim())
      .map((line) => {
        const filter = adb.parseFilter(line);
        const outputPath = `${outputPrefixPath}/${outputFileName}`;

        if (filter === null) {
          return line;
        }

        // Count bad filters
        if (filter.isBadFilter?.()) {
          badfilters.set(filter.getIdWithoutBadFilter(), outputPath);
          return `! [badfilter] ${line}`;
        }
        const badfilter = badfilters.get(filter.getIdWithoutBadFilter?.());
        if (badfilter !== undefined) {
          badfiltersCount += 1;
          return `! [badfilter] from ${badfilter}\n! ${line}`;
        }

        // Count duplicates
        const dup = seen.get(filter.getId());
        if (dup !== undefined) {
          duplicatesCount += 1;
          return `! [dup] from ${dup}\n! ${line}`;
        }
        seen.set(filter.getId(), outputPath);

        return line;
      });

    fs.writeFileSync(path.join(__dirname, outputPrefixPath, outputFileName), lines.join('\n'), 'utf-8');
  }

  console.log({ duplicates: duplicatesCount, badfilters: badfiltersCount });
})();
