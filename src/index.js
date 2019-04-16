import yargs from 'yargs';
import axios from 'axios';
import { URL } from 'url';
import qs from 'qs';
import $ from 'cheerio';
import _ from 'lodash';
import fs from 'fs';
import { promisify } from 'util';


const BANK_SLIP_REQUEST_URL = 'http://unimedmaceio.com.br/novosite/templates/areasrestritas/clientes/views/segunda-via-de-boleto.php';
// Download links are relative to the base URL below
const BANK_SLIP_DOWNLOAD_BASE_URL = 'http://unimedmaceio.com.br/novosite/templates/areasrestritas/clientes/views/';

const writeFileAsync = promisify(fs.writeFile);

async function makeListBankSlipsRequest(accountId) {
  return axios.post(BANK_SLIP_REQUEST_URL, qs.stringify({
    origem: 'segunda-via-de-boleto',
    carteira: accountId,
  })).then(response => response.data);
}

async function makeGetBankSlipFileRequest(url) {
  return axios.get(url, { responseType: 'arraybuffer' })
    .then(response => response.data);
}

async function getBankSlips(html) {
  const elements = await $('#frm2aViaBoleto a.list-group-item', html);
  return _.chain(elements)
    .map(element => BANK_SLIP_DOWNLOAD_BASE_URL + element.attribs.href)
    .map(url => ({
      url,
      filename: `${new URL(url).searchParams.get('carnet')}.pdf`,
    }))
    .value();
}

async function saveBankSlip(data, filename) {
  return writeFileAsync(filename, data);
}

async function downloadBankSlip(accountId, basePath) {
  const html = await makeListBankSlipsRequest(accountId);
  const bankSlips = await getBankSlips(html);
  await Promise.all(bankSlips.map(slip => makeGetBankSlipFileRequest(slip.url)
    .then(data => saveBankSlip(data, `${basePath}/${slip.filename}`))));
}

// eslint-disable-next-line no-unused-expressions
yargs
  .command(
    '$0 <account> [path]',
    'Download Unimed Maceió bank slips',
    (_yargs) => {
      _yargs
        .positional('account', {
          describe: 'Unimed Maceió account number without 0 065 and without last digit',
          type: 'string',
        })
        .positional('path', {
          describe: 'Path where to save the bank slips',
          type: 'string',
          default: '.',
        });
    },
    args => downloadBankSlip(args.account, args.path),
  )
  .help()
  .argv;
