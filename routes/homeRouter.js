const express = require('express');
const router =  express.Router();

const homeController = require('../controllers/homeController.js');

router.get('/',homeController.index);
router.get('/mapid',homeController.mapid);
router.post('/getReflectanceL',homeController.getReflectanceLandsat);
router.post('/getReflectanceM',homeController.getReflectanceModis);
router.post('/calculate',homeController.runCalculate);
// router.post('/extraction',homeController.extractDataLandsat);
router.post('/timeSeries',homeController.timeSeries);
router.get('/fetchData', homeController.fetchGanga);
// router.post('/addCycle', homeController.addCycle);
// router.post('/addStand', homeController.addStand);
// router.post('/prebook',  homeController.prebook);
router.post('/addToken', homeController.addFCM);
// router.get('/getStats',  homeController.getStats);
// router.post('/book',  homeController.book);
// router.post('/end',  homeController.endRide);

module.exports = router;
