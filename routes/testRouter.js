const express = require('express');
const router =  express.Router();

const testController = require('../controllers/testController.js');

router.get('/',testController.index);
router.get('/mapid',testController.mapid);
router.post('/getReflectanceL',testController.getReflectanceLandsat);
router.post('/getReflectanceM',testController.getReflectanceModis);
router.post('/calculate',testController.runCalculate);
// router.post('/extraction',testController.extractDataLandsat);
router.post('/timeSeries',testController.timeSeries);

module.exports = router;
