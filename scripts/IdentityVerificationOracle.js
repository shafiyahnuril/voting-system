// IdentityVerificationOracle.js - Chainlink External Adapter untuk verifikasi identitas

const { Requester, Validator } = require('@chainlink/external-adapter');
const crypto = require('crypto');

// API untuk verifikasi identitas (simulasi)
const API_ENDPOINT = 'https://api.identity-verification-service.com/verify';

// Konfigurasi custom error
const customError = (data) => {
  if (data.Response === 'Error') return true;
  return false;
};

// Fungsi utama untuk membuat Chainlink request
const createRequest = (input, callback) => {
  // Validasi input
  const validator = new Validator(input, {
    idNumber: ['required', 'string'],
    userAddress: ['required', 'string']
  });

  if (validator.error) {
    callback(validator.error.statusCode, {
      jobRunID: input.id,
      status: 'errored',
      error: validator.error,
      data: validator.errored
    });
    return;
  }

  const { idNumber, userAddress } = validator.validated.data;

  // Enkripsi data KTP untuk privasi
  const identityHash = crypto
    .createHash('sha256')
    .update(`${idNumber}-${userAddress}`)
    .digest('hex');

  // Pada implementasi sebenarnya, kita akan mengirim permintaan ke API verifikasi identitas
  // Simulasi respons verifikasi
  const simulateVerification = () => {
    // Dalam implementasi sebenarnya, kita akan memeriksa identitas dengan database pemerintah
    // atau layanan pihak ketiga yang terverifikasi
    // Simulasi: Hanya identitas dengan ID tertentu yang valid (untuk pengujian)
    const isValid = idNumber.length >= 16; // Simulasi validasi sederhana

    return {
      data: {
        success: true,
        identityHash: '0x' + identityHash,
        isValid: isValid
      }
    };
  };

  // Pada implementasi nyata, kita akan menggunakan Requester.request
  // untuk memanggil API eksternal
  /*
  const options = {
    url: API_ENDPOINT,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.API_KEY
    },
    data: {
      idNumber: idNumber
    }
  };

  Requester.request(options, customError)
    .then(response => {
      // Proses respons dan kirim kembali ke smart contract
      callback(response.status, {
        jobRunID: input.id,
        data: response.data,
        result: response.data.identityHash,
        statusCode: response.status
      });
    })
    .catch(error => {
      callback(500, {
        jobRunID: input.id,
        status: 'errored',
        error: error,
        statusCode: 500
      });
    });
  */

  // Untuk simulasi, kita gunakan respons langsung
  const response = simulateVerification();
  callback(200, {
    jobRunID: input.id,
    data: response.data,
    result: [
      response.data.identityHash, 
      response.data.isValid
    ],
    statusCode: 200
  });
};

// Ekspor fungsi untuk digunakan sebagai EA Chainlink
module.exports.createRequest = createRequest;

// Ekspor untuk AWS Lambda
module.exports.handler = (event, context, callback) => {
  createRequest(event, (statusCode, data) => {
    callback(null, data);
  });
};

// Ekspor untuk server Express
module.exports.gcpservice = (req, res) => {
  createRequest(req.body, (statusCode, data) => {
    res.status(statusCode).send(data);
  });
};

// Server local untuk pengembangan dan pengujian
if (require.main === module) {
  const port = process.env.EA_PORT || 8080;
  const express = require('express');
  const bodyParser = require('body-parser');
  const app = express();

  app.use(bodyParser.json());

  app.post('/', (req, res) => {
    console.log('Menerima permintaan verifikasi identitas:', req.body);
    createRequest(req.body, (statusCode, data) => {
      res.status(statusCode).json(data);
    });
  });

  app.listen(port, () => console.log(`Identity Verification Oracle berjalan di port ${port}!`));
}