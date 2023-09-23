const ee = require("@google/earthengine");
const express = require("express");
const privateKey = require("../.private-key.json");
const wv = require("../wv_aw_bw.json");
const wv_data = JSON.parse(wv);
const { PythonShell } = require("python-shell");
const fs = require("fs");
const path = require("path");
const os = require('os');
const { exec } = require("child_process");
const Location = require('../models/locationModel')
const Token = require('../models/tokenModel')
// const {admin} = require('../firebase.js');
const admin = require("firebase-admin");
// Define endpoint at /mapid.
// const app = express().get('/mapid', (_, response) => {
//   const srtm = ee.Image('CGIAR/SRTM90_V4');
//   const slope = ee.Terrain.slope(srtm);
//   slope.getMap({min: 0, max: 60}, ({mapid}) => response.send(mapid));
// });

const rrs = (R) => {
  return R / (0.52 + 1.7 * R);
};

const u = (rrs) => {
  let g0 = 0.089;
  let g1 = 0.1245;
  return (-g0 + Math.pow(Math.pow(g0, 2) + 4 * g1 * rrs, 0.5)) / (2 * g1);
};

const bbp = (W, bbp_B0, R443, R550) => {
  // let B0 = 550;
  let B0 = 560;
  let e = Math.exp((-0.9 * rrs(R443)) / rrs(R550));
  let g = 2.0 * (1 - 1.2 * e);
  // console.log('w',W);
  return bbp_B0 * Math.pow(B0 / W, g);
};

const a = (W, Rrs, bbp_B0, R443, R550) => {
  const bb = bw(W) + bbp(W, bbp_B0, R443, R550);
  // console.log('bb', W, bb);
  // console.log('bw', W, bw(W));
  // console.log('u', W, u(rrs(Rrs)));
  // console.log('a', W, (1-u(rrs(Rrs)))*(bb)/u(rrs(Rrs)));
  return ((1 - u(rrs(Rrs))) * bb) / u(rrs(Rrs));
};

const aw = (W) => {
  if (W == 443) {
    W = 440;
    return 0.00721;
  }
  if (W == 412) {
    W = 410;
    return 0.00469;
  }
  if (W == 560) {
    return 0.0619;
  }
  if (W == 645) {
    W = 640;
  }
  return wv_data[W]["aw"];
};

const bw = (W) => {
  if (W == 443) {
    W = 440;
    return 0.0023885;
  }
  if (W == 412) {
    W = 410;
    return 0.003328;
  }
  if (W == 560) {
    return 0.0008994;
  }
  if (W == 645) {
    W = 640;
  }
  return wv_data[W]["bw"];
};

const calculate = async (R412, R443, R488, R550, R667) => {
  // console.log(R412,R443,R488,R550,R667)
  let Rrs670_upper = 20.0 * Math.pow(R550, 1.5);
  let Rrs670_lower = 0.9 * Math.pow(R550, 1.7);
  // if Rrs[670] out of bounds, reassign its value by QAA v5.
  if (R667 > Rrs670_upper || R667 < Rrs670_lower || R667 == NaN) {
    let Rrs670 = 0.00018 * Math.pow(R488 / R550, -3.19);
    Rrs670 += 1.27 * Math.pow(R550, 1.47);
    R667 = Rrs670;
    // console.log('1',R667);
  }
  // console.log('2',R667);
  let a_550 = 0;
  //  if(R667<0.0015){
  let p1 = rrs(R443) + rrs(R488);
  let p2 = rrs(R550) + 5 * (rrs(R667) / rrs(R488)) * rrs(R667);
  let x = Math.log10(p1 / p2);
  let h0 = -1.146;
  let h1 = -1.366;
  let h2 = -0.469;
  // a_550 = aw(550)+(Math.pow(10,(h0+(h1*x)+(h2*(Math.pow(x,2))))));
  a_550 = aw(560) + Math.pow(10, h0 + h1 * x + h2 * Math.pow(x, 2));
  //  }
  //  else{
  //    a_550=aw(550) + 0.39*Math.pow((R550/(R443+R488)),1.14);
  //  }
  //  console.log('a0', '560', a_550);
  //  console.log('u', u(rrs(R550)));

  //  let bbp_B0 = u(rrs(R550))*a_550/(1-a_550) - bw(550);
  let bbp_B0 = (u(rrs(R550)) * a_550) / (1 - u(rrs(R550))) - bw(560);
  //  console.log('bb0', bbp_B0+bw(560));

  //  let bbp=bbp_B0*Math.pow((B0/W),g);
  let S0 = 0.015;
  let W = 440;
  let R = R443;
  let Zeta = 0.74 + 0.2 / (0.8 + rrs(R443) / rrs(R550));

  let S = S0 + 0.002 / (0.6 + rrs(R443) / rrs(R550));
  let Xi = Math.exp(S * 30);
  //  let adg443=((a(412,R412, bbp_B0, R443, R550)-(Zeta*a(443,R443, bbp_B0, R443, R550)))-(aw(412)-(Zeta*aw(443))))/(Xi-Zeta);
  let adg443 =
    (a(410, R412, bbp_B0, R443, R550) -
      Zeta * a(440, R443, bbp_B0, R443, R550) -
      (aw(412) - Zeta * aw(443))) /
    (Xi - Zeta);
  //  let adg=adg443*Math.exp((-S*(W-443)));
  let adg = adg443 * Math.exp(-S * (W - 440));
  let aph = a(W, R, bbp_B0, R443, R550) - adg - aw(W);
  //  console.log(Zeta, S, Xi, adg443, adg, aph);
  //  console.log(aph);
  //  console.log(rrs(R443));
  //  return Math.pow(aph/0.05,1/0.626);
  // let options = {
  //   mode: 'text',
  //   // pythonPath: 'path/to/python',
  //   pythonOptions: ['-u'], // get print results in real-time
  //   scriptPath: './controllers',
  //   args: [bw(W)+bbp(W, bbp_B0, R443, R550),W,R443,rrs(R443),a(440,R443, bbp_B0, R443, R550),aw(W),bw(W)]
  // };
  // const { success, err='', results } = await new Promise(function(myResolve, myReject) {
  //   // "Producing Code" (May take some time)
  //   PythonShell.run('predict.py', options, function (err, results) {
  //     if (err) {
  //       myReject({ success: false, err });
  //     }
  //     // results is an array consisting of messages collected during execution
  //     // console.log(err);
  //     // console.log('results');
  //     // console.log(results);
  //     // console.log(results[2].substring(2, results[2].length-2));
  //     myResolve({ success: true, results: results[results.length-1].substring(2, results[results.length-1].length-2)}); // when successful
  //   });

  //     // myReject();  // when error
  //   });

  //   if (success)
  //   {
  //       return [results, {
  //         b443: bw(W) + bbp(W, bbp_B0, R443, R550), w: W, R443: R443, r443: rrs(R443), a443: a(440,R443, bbp_B0, R443, R550),aw443: aw(W), bw443: bw(W)
  //       }];
  //   } else {
  //           console.log("Test Error: " + err);
  //       return;
  //   }
  // }
  // myPromise.then(
  //   function(value) { /* code if successful */
  //   return value;
  // },
  //   function(error) { /* code if some error */
  //   return -1;
  // }
  // );
  // console.log('calculate: '+[
  //   bw(W) + bbp(W, bbp_B0, R443, R550),
  //   W,
  //   R443,
  //   rrs(R443),
  //   a(440, R443, bbp_B0, R443, R550),
  //   aw(W),
  //   bw(W),
  // ]);
  // console.log("IMPORTANT");
  let a_coeff = [0.26294, -2.64669, 1.28364, 1.08209, -1.76828];
  let latter = 0;
  for (let index = 1; index <= 4; index++) {
    latter += a_coeff[index]*(Math.pow(Math.log10(R443/R550),index));
  }	
  let chl_a = Math.pow(10,a_coeff[0] + latter);
  // console.log("CHLOROPHYLL  "+chl_a);
  return [
    bw(W) + bbp(W, bbp_B0, R443, R550),
    W,
    R443,
    rrs(R443),
    a(440, R443, bbp_B0, R443, R550),
    aw(W),
    bw(W),
  ];
};

const fui = async (R443, R488, R550, R667) => {
    let X = 11.053*R443 + 6.95*R488 + 51.135*R550 + 34.457*R667;
    let Y = 1.32*R443 + 21.053*R488 + 66.023*R550 + 18.034*R667;
    let Z = 58.038*R443 + 34.931*R488 + 2.606*R550 + 0.016*R667;

    let x = X/(X+Y+Z);
    let y = Y/(X+Y+Z);

    let x1 = y-1/3;
    let y1 = x-1/3;
    
    let alpha = (Math.atan2(x1,y1)*180/Math.PI);
    console.log("\n--------------------Intermediate Calculations -----------------------\n");
    console.log('HUE ANGLE (ALPHA) : ',alpha);
    let b=0.01*alpha;
    console.log('BETA : ',b);
    let dAlpha = 21.355*Math.pow(b,5) - (199.29*Math.pow(b,4)) + (703.3*Math.pow(b,3)) - (1132.2*Math.pow(b,2)) + (801.6*b) - 201.34;
    console.log('DELTA_ALPHA : ',dAlpha)
    let res_alpha = alpha + dAlpha;
    return res_alpha;
}

const runCalculate = async (req, res) => {
  // console.log(req.body);
  // const result = await calculate(parseFloat(req.body.b8)*0.0001, parseFloat(req.body.b9)*0.0001, parseFloat(req.body.b10)*0.0001, parseFloat(req.body.b12)*0.0001, parseFloat(req.body.b13)*0.0001);
  const result = await calculate(
    parseFloat(req.body.b8) * 1,
    parseFloat(req.body.b9) * 1,
    parseFloat(req.body.b10) * 1,
    parseFloat(req.body.b12) * 1,
    parseFloat(req.body.b13) * 1
  );
  // console.log('predicted value', result);
  res.json({
    status: true,
    message: "Welcome to Tirtham",
    errors: [],
    data: {
      predicted_chl: result[0],
      calculated_vars: result[1],
    },
  });
};

const index = async (req, res) => {
  res.json({
    status: true,
    message: "Welcome to Tirtham API",
    errors: [],
    data: {},
  });
};
var convert = function (o) {
  try {
    if (o instanceof ee.ComputedObject) {
      o = o.getInfo();
      // console.log(typeof(o));
    }
    return o;
  } catch (error) {
    return {}
  }
  
};

const mapid = async (req, res) => {
  const srtm = ee.ImageCollection("MODIS/006/MCD43A4");
  const slope = ee.Terrain.slope(srtm);
  slope.getMap({ min: 0, max: 60 }, ({ mapid }) =>
    res.json({
      status: true,
      message: "Welcome to Tirtham",
      errors: [],
      data: {
        mapid: mapid,
      },
    })
  );
};

const getReflectanceLandsat = async (req, res) => {
  try {
  
  console.log("\n-------------------- Real time water quality analysis ------------------------\n");
  console.log("Latitude value");
  console.log(req.body.lat);
  console.log("\nLongitude value");
  console.log(req.body.long);

  function bufferPoints(radius, bounds) {
    return function (pt) {
      pt = ee.Feature(pt);
      return bounds ? pt.buffer(radius).bounds() : pt.buffer(radius);
    };
  }

  const zonalStats = async (ic, fc, params) => {
    // Initialize internal params dictionary.
    var _params = {
      reducer: ee.Reducer.mean(),
      scale: null,
      crs: null,
      bands: null,
      bandsRename: null,
      imgProps: null,
      imgPropsRename: null,
      datetimeName: "datetime",
      datetimeFormat: "YYYY-MM-dd HH:mm:ss",
    };

    // Replace initialized params with provided params.
    if (params) {
      for (var param in params) {
        _params[param] = params[param] || _params[param];
      }
    }

    // Set default parameters based on an image representative.
    var imgRep = ic.first();
    // console.log(convert(imgRep));
    var nonSystemImgProps = ee
      .Feature(null)
      .copyProperties(imgRep)
      .propertyNames();
    if (!_params.bands) _params.bands = imgRep.bandNames();
    if (!_params.bandsRename) _params.bandsRename = _params.bands;
    if (!_params.imgProps) _params.imgProps = nonSystemImgProps;
    if (!_params.imgPropsRename) _params.imgPropsRename = _params.imgProps;

    // Map the reduceRegions function over the image collection.
    var results = await ic
      .map(function (img) {
        // Select bands (optionally rename), set a datetime & timestamp property.
        img = ee
          .Image(img.select(_params.bands, _params.bandsRename).divide(3.6e6))
          .set(_params.datetimeName, img.date().format(_params.datetimeFormat))
          .set("timestamp", img.get("system:time_start"));

        // Define final image property dictionary to set in output features.
        var propsFrom = ee
          .List(_params.imgProps)
          .cat(ee.List([_params.datetimeName, "timestamp"]));
        var propsTo = ee
          .List(_params.imgPropsRename)
          .cat(ee.List([_params.datetimeName, "timestamp"]));
        // var imgProps = img.toDictionary(propsFrom).rename(propsFrom, propsTo);
        var imgProps = img.toDictionary(propsFrom);

        // Subset points that intersect the given image.
        var fcSub = fc.filterBounds(img.geometry());

        // Reduce the image by regions.
        return (
          img
            .reduceRegions({
              collection: fcSub,
              reducer: _params.reducer,
              scale: _params.scale,
              crs: _params.crs,
            })
            // Add metadata to each feature.
            .map(function (f) {
              return f.set(imgProps);
            })
        );
      })
      .flatten()
      .filter(ee.Filter.notNull(_params.bandsRename));

    // console.log(results);
    return results;
  };

  var pts = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Point([parseFloat(req.body.long),parseFloat(req.body.lat)]), {
      plot_id: 1,
    }),
    ee.Feature(ee.Geometry.Point([parseFloat(req.body.long)-0.02, parseFloat(req.body.lat)-0.0002]), {plot_id: 2}),
    ee.Feature(ee.Geometry.Point([parseFloat(req.body.long)+0.02, parseFloat(req.body.lat)+0.0002]), {plot_id: 3}),
    ee.Feature(ee.Geometry.Point([parseFloat(req.body.long)-0.02, parseFloat(req.body.lat)+0.0002]), {plot_id: 4}),
    ee.Feature(ee.Geometry.Point([parseFloat(req.body.long)+0.02, parseFloat(req.body.lat)-0.0002]), {plot_id: 5})
  ]);

  function fmask(img) {
    var cloudShadowBitMask = 1 << 3;
    var cloudsBitMask = 1 << 5;
    var qa = img.select("QA_PIXEL");
    var mask = qa
      .bitwiseAnd(cloudShadowBitMask)
      .eq(0)
      .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
    return img.updateMask(mask);
  }

  function renameOli(img) {
    return img.select(
      ["SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B6", "SR_B7"],
      ["Blue", "Green", "Red", "NIR", "SWIR1", "SWIR2"]
    );
  }

  // Selects and renames bands of interest for TM/ETM+.
  function renameEtm(img) {
    return img.select(
      ["B1", "B2", "B3", "B4", "B5", "B7"],
      ["Blue", "Green", "Red", "NIR", "SWIR1", "SWIR2"]
    );
  }

  // Prepares (cloud masks and renames) OLI images.
  function prepOli(img) {
    // img = fmask(img);
    // img = renameOli(img);
    return img;
  }

  // Prepares (cloud masks and renames) TM/ETM+ images.
  function prepEtm(img) {
    // img = fmask(img);
    // img = renameEtm(img);
    return img;
  }

  var ptsLandsat = pts.map(bufferPoints(15, true));

  var oliCol = ee
    .ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .filterBounds(ptsLandsat);
  // .map(prepOli);
  // console.log(convert(oliCol));
  // var etmCol = ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')
  //   .filterBounds(ptsLandsat)
  //   .map(prepEtm);

  // var tmCol = ee.ImageCollection('LANDSAT/LT05/C01/T1_SR')
  //   .filterBounds(ptsLandsat)
  //   .map(prepEtm);

  // var landsatCol = oliCol.merge(etmCol).merge(tmCol);

  var params = {
    reducer: ee.Reducer.mean(),
    scale: 30,
    crs: "EPSG:5070",
    // bands: ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2'],
    bands: ["SR_B1", "SR_B2", "SR_B3", "SR_B4"],
    // bandsRename: ["ls_blue", "ls_green", "ls_red"],
    bandsRename: ["R443", "R488", "R550", "R667"],
    // imgProps: ['LANDSAT_ID', 'SATELLITE'],
    // imgPropsRename: ['img_id', 'satellite'],
    datetimeName: "date",
    datetimeFormat: "YYYY-MM-dd",
  };

  // Extract zonal statistics per point per image.
  var ptsLandsatStats = zonalStats(oliCol, ptsLandsat, params).then(
    async (result) => {
      // console.log(result);
      // console.log(convert(result.limit(1)));
      var data1 = convert(result).features;
      if(data1){
        const toSaveNonSplit = data1.map(element => element.properties);
        let toSave = [];
        for (let index = 0; index < toSaveNonSplit.length-1; index++) {
          // console.log(toSaveNonSplit[index]['date']);
          if(new Date(toSaveNonSplit[index]['date']) > new Date(toSaveNonSplit[index+1]['date'])) {
            toSave.push(toSaveNonSplit[index]);
            break;
          } else {
            toSave.push(toSaveNonSplit[index]);
          }
        }
      var data1 = Array.from(toSave);

      
      // const data = data1[data1.length - 1].properties;
      const data = data1[data1.length - 1];
      // res.json({
      //   status: true,
      //   message: "Welcome to Tirtham",
      //   errors: [],
      //   data: {
      //     data: convert(result.limit(1)),
      //   },
      // });
      
      // var datum0 = data1[data1.length - 1].properties;
      var datum0 = data1[data1.length - 1];
      const alpha = await fui(
          parseFloat(datum0["R443"]) * 1,
          parseFloat(datum0["R488"]) * 1,
          parseFloat(datum0["R550"]) * 1,
          parseFloat(datum0["R667"]) * 1
        );
      console.log('ALPHA + DELTA_ALPHA : ', alpha);
      var res_array = [];
      for (let index = 1; index < 6; index++) {
        // var datum = data1[data1.length - index].properties;
        var datum = data1[data1.length - index];
        // console.log(datum);
        var element = await calculate(
          parseFloat(datum["R443"]) * 1,
          parseFloat(datum["R443"]) * 1,
          parseFloat(datum["R488"]) * 1,
          parseFloat(datum["R550"]) * 1,
          parseFloat(datum["R667"]) * 1
        );
        res_array.push(element);
      }
      // console.log(res_array);
      let options = {
        mode: "text",
        // pythonPath: '/usr/bin/python3.7',
        // pythonOptions: ["-u"], // get print results in real-time
        // scriptPath: path.join(__dirname,'controllers'),
        scriptPath: __dirname,
        args: res_array,
      };
      
      // exec('python3 -c "import sys; print(sys.path)"', (error, stdout, stderr) => {
      //     if (error) {
      //         console.log(`error: ${error.message}`);
      //         return;
      //     }
      //     if (stderr) {
      //         console.log(`stderr: ${stderr}`);
      //         return;
      //     }
      //     console.log(`stdout: ${stdout}`);
      // });
      // console.log(os.type());
      // fs.readdir(__dirname, (err, files) => {
      //   files.forEach(file => {
      //     console.log(file);
      //   });
      // });
      const {
        success,
        err = "",
        results,
      } = await new Promise(function (myResolve, myReject) {
        // "Producing Code" (May take some time)
        PythonShell.run("predict.py", options, async function (err, results) {
          if (err) {
            console.log(err);
            myReject({ success: false, err });
          }
          // results is an array consisting of messages collected during execution
          // console.log(err);
          console.log('\n------------------- model predictions ----------------------\n');
          console.log(results);
          // console.log(results[2].substring(2, results[2].length-2));
          myResolve({
            success: true,
            results: results[results.length-1],
            
          }); // when successful
        });

        // myReject();  // when error
      });
      
      if (success) {
        // return [
        //   results,
        //   {
        //     b443: bw(W) + bbp(W, bbp_B0, R443, R550),
        //     w: W,
        //     R443: R443,
        //     r443: rrs(R443),
        //     a443: a(440, R443, bbp_B0, R443, R550),
        //     aw443: aw(W),
        //     bw443: bw(W),
        //   },
        // ];

        // console.log(results);
        // console.log(data);
        console.log("\n-------------------- Satellite data ------------------------\n");
        console.log('SURFACE REFLECTANCE AT 440 : ', data["R443"]);
        console.log('SURFACE REFLECTANCE AT 488 : ', data["R488"]);
        console.log('SURFACE REFLECTANCE AT 550 : ', data["R550"]);
        console.log('SURFACE REFLECTANCE AT 667 : ', data["R667"]);
        console.log('DATETIME : ', data["date"]);
        console.log('\n');

        console.log("\n-------------------- Calculated Params ------------------------\n");
        console.log('WAVELENGTH : ', res_array[0][1]);
        console.log('TOTAL ABSORPTION COEFF : ', res_array[0][4]);
        console.log('TOTAL BACK SCATTERING COEFF : ', res_array[0][0]);
        console.log('ABOVE SURFACE REFLECTANCE : ', res_array[0][2]);
        console.log('BELOW SURFACE REFLECTANCE : ', res_array[0][3]);
        console.log('SEAWATER ABSORPTION COEFF : ', res_array[0][5]);
        console.log('SEAWATER BACK SCATTERING COEFF : ', res_array[0][6]);
        console.log('\n');
        res.json({
          status: true,
          message: "Welcome to Tirtham",
          errors: [],
          data: {
            fui_alpha: alpha,
            satellite_data: data,
            predicted_chl: results,
            calculated_vars: {b443:res_array[0][0],w:res_array[0][1],R443:res_array[0][2],r443:res_array[0][3],a443:res_array[0][4],aw443:res_array[0][5],bw443:res_array[0][6]},
          },
        });
      } else {
        // console.log("Test Error: " + err);
        // return;
        res.json({
          status: false,
          message: "Welcome to Tirtham",
          errors: [err],
          data: {
            
          },
        });
      }
    }
    else{
      res.json({
        status: false,
        message: "No image found",
        errors: ["No image found"],
        data: {},
      });
    }
  }
  );
} catch (error) {;
  console.log(error)
  res.json({
    status: false,
    message: "Welcome to Tirtham",
    errors: [error],
    data: {},
  });
}
  //   Map.centerObject(geometry,20)
};

const getReflectanceModis = async (req, res) => {
  console.log(req.body.lat);
  console.log(req.body.long);
  function bufferPoints(radius, bounds) {
    return function (pt) {
      pt = ee.Feature(pt);
      return bounds ? pt.buffer(radius).bounds() : pt.buffer(radius);
    };
  }

  async function zonalStats(ic, fc, params) {
    // Initialize internal params dictionary.
    var _params = {
      reducer: ee.Reducer.mean(),
      scale: null,
      crs: null,
      bands: null,
      bandsRename: null,
      imgProps: null,
      imgPropsRename: null,
      datetimeName: "datetime",
      datetimeFormat: "YYYY-MM-dd HH:mm:ss",
    };

    // Replace initialized params with provided params.
    if (params) {
      for (var param in params) {
        _params[param] = params[param] || _params[param];
      }
    }

    // Set default parameters based on an image representative.
    var imgRep = ic.first();
    var nonSystemImgProps = ee
      .Feature(null)
      .copyProperties(imgRep)
      .propertyNames();
    if (!_params.bands) _params.bands = imgRep.bandNames();
    if (!_params.bandsRename) _params.bandsRename = _params.bands;
    if (!_params.imgProps) _params.imgProps = nonSystemImgProps;
    if (!_params.imgPropsRename) _params.imgPropsRename = _params.imgProps;

    // Map the reduceRegions function over the image collection.
    var results = ic
      .map(function (img) {
        // Select bands (optionally rename), set a datetime & timestamp property.
        img = ee
          .Image(img.select(_params.bands, _params.bandsRename).divide(1e4))
          .set(_params.datetimeName, img.date().format(_params.datetimeFormat))
          .set("timestamp", img.get("system:time_start"));

        // Define final image property dictionary to set in output features.
        var propsFrom = ee
          .List(_params.imgProps)
          .cat(ee.List([_params.datetimeName, "timestamp"]));
        var propsTo = ee
          .List(_params.imgPropsRename)
          .cat(ee.List([_params.datetimeName, "timestamp"]));
        // var imgProps = img.toDictionary(propsFrom).rename(propsFrom, propsTo);
        var imgProps = img.toDictionary(propsFrom);

        // Subset points that intersect the given image.
        var fcSub = fc.filterBounds(img.geometry());

        // Reduce the image by regions.
        return (
          img
            .reduceRegions({
              collection: fcSub,
              reducer: _params.reducer,
              scale: _params.scale,
              crs: _params.crs,
            })
            // Add metadata to each feature.
            .map(function (f) {
              return f.set(imgProps);
            })
        );
      })
      .flatten()
      .filter(ee.Filter.notNull(_params.bandsRename));

    return results;
  }

  var pts = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Point([req.body.long,req.body.lat]), {
      plot_id: 1,
    }),
    ee.Feature(ee.Geometry.Point([req.body.long-0.02, req.body.lat-0.0002]), {plot_id: 2}),
    ee.Feature(ee.Geometry.Point([req.body.long+0.02, req.body.lat+0.0002]), {plot_id: 3}),
    ee.Feature(ee.Geometry.Point([req.body.long-0.02, req.body.lat+0.0002]), {plot_id: 4}),
    ee.Feature(ee.Geometry.Point([req.body.long+0.02, req.body.lat-0.0002]), {plot_id: 5})
    // ee.Feature(ee.Geometry.Point([-118.6010, 37.0777]), {plot_id: 1}),
    // ee.Feature(ee.Geometry.Point([-118.5896, 37.0778]), {plot_id: 2}),
    // ee.Feature(ee.Geometry.Point([-118.5842, 37.0805]), {plot_id: 3}),
    // ee.Feature(ee.Geometry.Point([-118.5994, 37.0936]), {plot_id: 4}),
    // ee.Feature(ee.Geometry.Point([-118.5861, 37.0567]), {plot_id: 5})
  ]);

  var ptsModis = pts.map(bufferPoints(50, true));

  var modisCol = ee
    .ImageCollection("MODIS/006/MODOCGA")
    .filterDate("2021-01-01", "2022-12-01");

  // Define parameters for the zonalStats function.
  var params = {
    reducer: ee.Reducer.mean(),
    scale: 500,
    crs: "EPSG:5070",
    bands: [
      "sur_refl_b08",
      "sur_refl_b09",
      "sur_refl_b10",
      "sur_refl_b12",
      "sur_refl_b13",
    ],
    bandsRename: ["R412", "R443", "R488", "R550", "R667"],
    datetimeName: "date",
    datetimeFormat: "YYYY-MM-dd",
  };

  // Extract zonal statistics per point per image.
  var ptsModisStats = zonalStats(modisCol, ptsModis, params).then(
    async (result) => {
      var data1 = convert(result).features;
      var data1 = Array.from(data1);
      // var data = convert(result.limit(1)).features[0].properties;
      const data = data1[data1.length - 1].properties;
      // console.log(data);
      // console.log(data1[data1.length - 1]);
      var res_array = [];
      for (let index = 1; index < 51; index++) {
        var datum = data1[data1.length - index].properties;
        // console.log(datum);
        var element = await calculate(
          parseFloat(datum["R412"]) * 1,
          parseFloat(datum["R443"]) * 1,
          parseFloat(datum["R488"]) * 1,
          parseFloat(datum["R550"]) * 1,
          parseFloat(datum["R667"]) * 1
        );
        res_array.push(element);
      }
      console.log(res_array);
      let options = {
        mode: "text",
        // pythonPath: 'path/to/python',
        pythonOptions: ["-u"], // get print results in real-time
        scriptPath: "./controllers",
        args: res_array,
      };
      // console.log(options);
      const {
        success,
        err = "",
        results,
      } = await new Promise(function (myResolve, myReject) {
        // "Producing Code" (May take some time)
        PythonShell.run("predict.py", options, function (err, results) {
          if (err) {
            myReject({ success: false, err });
          }
          // results is an array consisting of messages collected during execution
          console.log(err);
          console.log('results');
          console.log(results);
          // console.log(results[2].substring(2, results[2].length-2));
          myResolve({
            success: true,
            results: results[results.length-1],
            
          }); // when successful
        });

        // myReject();  // when error
      });

      if (success) {
        // return [
        //   results,
        //   {
        //     b443: bw(W) + bbp(W, bbp_B0, R443, R550),
        //     w: W,
        //     R443: R443,
        //     r443: rrs(R443),
        //     a443: a(440, R443, bbp_B0, R443, R550),
        //     aw443: aw(W),
        //     bw443: bw(W),
        //   },
        // ];
        console.log(results);
        console.log(data);
        res.json({
          status: true,
          message: "Welcome to Tirtham",
          errors: [],
          data: {
            satellite_data: data,
            predicted_chl: results,
            calculated_vars: {b443:res_array[0][0],w:res_array[0][1],R443:res_array[0][2],r443:res_array[0][3],a443:res_array[0][4],aw443:res_array[0][5],bw443:res_array[0][6]},
          },
        });
      } else {
        console.log("Test Error: " + err);
        // return;
        res.json({
          status: false,
          message: "Welcome to Tirtham",
          errors: [err],
          data: {
            
          },
        });
      }
    }
  );
  // const result1 = await calculate(parseFloat(data['R412'])*1, parseFloat(data['R443'])*1, parseFloat(data['R488'])*1, parseFloat(data['R550'])*1, parseFloat(data['R667'])*1);
  // console.log('predicted value', result1);
  // console.log(R412);
  // res.json({
  //   status: true,
  //   message: "Welcome to Tirtham",
  //   errors: [],
  //   data: {
  //     satellite_data: convert(result.limit(1)).features[0].properties,
  //     // predicted_chl: result1[0],
  //     // calculated_vars: result1[1]
  //   },
  // });
  // });

  //   Map.centerObject(geometry,20)
};

const timeSeries = async (req, res) => {
  try {
    
  
  const today = new Date();
  const yyyy = today.getFullYear();
  let mm = today.getMonth() + 1; // Months start at 0!
  let dd = today.getDate();

  if (dd < 10) dd = '0' + dd;
  if (mm < 10) mm = '0' + mm;

  const formattedToday = yyyy + '-' + mm + '-' + dd;
  console.log("\n-------------------- Future Time Series Analysis ------------------------\n");
  console.log("Latitude value");
  console.log(req.body.lat);
  console.log("\nLongitude value");
  console.log(req.body.long);
  function bufferPoints(radius, bounds) {
    return function (pt) {
      pt = ee.Feature(pt);
      return bounds ? pt.buffer(radius).bounds() : pt.buffer(radius);
    };
  }

  const zonalStats = async (ic, fc, params) => {
    // Initialize internal params dictionary.
    var _params = {
      reducer: ee.Reducer.mean(),
      scale: null,
      crs: null,
      bands: null,
      bandsRename: null,
      imgProps: null,
      imgPropsRename: null,
      datetimeName: "datetime",
      datetimeFormat: "YYYY-MM-dd HH:mm:ss",
    };

    // Replace initialized params with provided params.
    if (params) {
      for (var param in params) {
        _params[param] = params[param] || _params[param];
      }
    }

    // Set default parameters based on an image representative.
    var imgRep = ic.first();
    // console.log(convert(imgRep));
    var nonSystemImgProps = ee
      .Feature(null)
      .copyProperties(imgRep)
      .propertyNames();
    if (!_params.bands) _params.bands = imgRep.bandNames();
    if (!_params.bandsRename) _params.bandsRename = _params.bands;
    if (!_params.imgProps) _params.imgProps = nonSystemImgProps;
    if (!_params.imgPropsRename) _params.imgPropsRename = _params.imgProps;

    // Map the reduceRegions function over the image collection.
    var results = await ic
      .map(function (img) {
        // Select bands (optionally rename), set a datetime & timestamp property.
        img = ee
          .Image(img.select(_params.bands, _params.bandsRename).divide(3.6e6))
          .set(_params.datetimeName, img.date().format(_params.datetimeFormat))
          .set("timestamp", img.get("system:time_start"));

        // Define final image property dictionary to set in output features.
        var propsFrom = ee
          .List(_params.imgProps)
          .cat(ee.List([_params.datetimeName, "timestamp"]));
        var propsTo = ee
          .List(_params.imgPropsRename)
          .cat(ee.List([_params.datetimeName, "timestamp"]));
        // var imgProps = img.toDictionary(propsFrom).rename(propsFrom, propsTo);
        var imgProps = img.toDictionary(propsFrom);

        // Subset points that intersect the given image.
        var fcSub = fc.filterBounds(img.geometry());

        // Reduce the image by regions.
        return (
          img
            .reduceRegions({
              collection: fcSub,
              reducer: _params.reducer,
              scale: _params.scale,
              crs: _params.crs,
            })
            // Add metadata to each feature.
            .map(function (f) {
              return f.set(imgProps);
            })
        );
      })
      .flatten()
      .filter(ee.Filter.notNull(_params.bandsRename));

    // console.log(results);
    return results;
  };

  var pts = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Point([parseFloat(req.body.long),parseFloat(req.body.lat)]), {
      plot_id: 1,
    }),
    // ee.Feature(ee.Geometry.Point([parseFloat(req.body.long-0.02), parseFloat(req.body.lat-0.0002)]), {plot_id: 2}),
    // ee.Feature(ee.Geometry.Point([parseFloat(req.body.long+0.02), parseFloat(req.body.lat+0.0002)]), {plot_id: 3}),
    // ee.Feature(ee.Geometry.Point([parseFloat(req.body.long-0.02), parseFloat(req.body.lat+0.0002)]), {plot_id: 4}),
    // ee.Feature(ee.Geometry.Point([parseFloat(req.body.long+0.02), parseFloat(req.body.lat-0.0002)]), {plot_id: 5})
  ]);

  function fmask(img) {
    var cloudShadowBitMask = 1 << 3;
    var cloudsBitMask = 1 << 5;
    var qa = img.select("QA_PIXEL");
    var mask = qa
      .bitwiseAnd(cloudShadowBitMask)
      .eq(0)
      .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
    return img.updateMask(mask);
  }

  function renameOli(img) {
    return img.select(
      ["SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B6", "SR_B7"],
      ["Blue", "Green", "Red", "NIR", "SWIR1", "SWIR2"]
    );
  }

  // Selects and renames bands of interest for TM/ETM+.
  function renameEtm(img) {
    return img.select(
      ["B1", "B2", "B3", "B4", "B5", "B7"],
      ["Blue", "Green", "Red", "NIR", "SWIR1", "SWIR2"]
    );
  }

  // Prepares (cloud masks and renames) OLI images.
  function prepOli(img) {
    // img = fmask(img);
    // img = renameOli(img);
    return img;
  }

  // Prepares (cloud masks and renames) TM/ETM+ images.
  function prepEtm(img) {
    // img = fmask(img);
    // img = renameEtm(img);
    return img;
  }

  var ptsLandsat = pts.map(bufferPoints(15, true));

  var oliCol = ee
    .ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .filterDate("2017-01-01", formattedToday)
    .filterBounds(ptsLandsat);
  // .map(prepOli);
  // console.log(convert(oliCol));
  // var etmCol = ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')
  //   .filterBounds(ptsLandsat)
  //   .map(prepEtm);

  // var tmCol = ee.ImageCollection('LANDSAT/LT05/C01/T1_SR')
  //   .filterBounds(ptsLandsat)
  //   .map(prepEtm);

  // var landsatCol = oliCol.merge(etmCol).merge(tmCol);

  var params = {
    reducer: ee.Reducer.mean(),
    scale: 30,
    crs: "EPSG:5070",
    // bands: ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2'],
    bands: ["SR_B1", "SR_B2", "SR_B3", "SR_B4"],
    // bandsRename: ["ls_blue", "ls_green", "ls_red"],
    bandsRename: ["R443", "R488", "R550", "R667"],
    // imgProps: ['LANDSAT_ID', 'SATELLITE'],
    // imgPropsRename: ['img_id', 'satellite'],
    datetimeName: "date",
    datetimeFormat: "YYYY-MM-dd",
  };

  // Extract zonal statistics per point per image.
  var ptsLandsatStats = zonalStats(oliCol, ptsLandsat, params).then(
    async (result) => {
      // console.log(convert(result).features);
      var data1 = convert(result).features;
      if(data1){
      var data1 = Array.from(data1);
      // [
      //   bw(W) + bbp(W, bbp_B0, R443, R550),
      //   W,
      //   R443,
      //   rrs(R443),
      //   a(440, R443, bbp_B0, R443, R550),
      //   aw(W),
      //   bw(W),
      // ];
      console.log("\n-------------------- Data Processing ------------------------\n");
      console.log('For loop started');
      const toSaveNonSplit = data1.map(element => element.properties);
      let toSave = [];
      for (let index = 0; index < toSaveNonSplit.length-1; index++) {
        if(new Date(toSaveNonSplit[index]['date']) > new Date(toSaveNonSplit[index+1]['date'])) {
          break;
        } else {
          toSave.push(toSaveNonSplit[index]);
        }
      }
      for (let index = 0; index < toSave.length; index++) {
        // const element = toSave[index];
        // let obj = element.properties;
        const calc =  await calculate(
              parseFloat(toSave[index]["R443"]) * 1,
              parseFloat(toSave[index]["R443"]) * 1,
              parseFloat(toSave[index]["R488"]) * 1,
              parseFloat(toSave[index]["R550"]) * 1,
              parseFloat(toSave[index]["R667"]) * 1
            );
        toSave[index]['bb'] = calc[0];
        toSave[index]['W'] = calc[1];
        toSave[index]['Rrs'] = calc[2];
        toSave[index]['rrs'] = calc[3];
        toSave[index]['a'] = calc[4];
        toSave[index]['aw'] = calc[5];
        toSave[index]['bw'] = calc[6];

        if(index == toSave.length-1) {
          // console.log(toSave);
          const jsonContent = JSON.stringify(toSave);
          // console.log(jsonContent);
          console.log('Saving data to local storage');

          fs.writeFile("file.json", jsonContent, 'utf8', async function (err) {
              if (err) {
                  return console.log(err);
              }
              console.log("The file was saved!");

              let options = {
                mode: "text",
                // pythonPath: 'path/to/python',
                pythonOptions: ["-u"], // get print results in real-time
                scriptPath: "./controllers",
                args: [],
              };
            const {
                success,
                er = "",
                results,
              } = await new Promise(function (myResolve, myReject) {
                // "Producing Code" (May take some time)
                console.log('\n------------------- model predictions ----------------------\n');
                console.log("MODEL USED FOR FUTURE PREDICTION : ", req.body.model == 1 ? "XGBOOST" : "NBEATS");
                PythonShell.run(req.body.model == 1 ? "xtimeseries.py" : "nbtimeseries.py", options, function (errr, results) {
                  if (errr) {
                    console.log(errr);
                    myReject({ success: false, errr });
                  }
                  // results is an array consisting of messages collected during execution
                  // console.log(err);
                  // console.log('results');
                  console.log('\n');
                  console.log("The results are in respective order");
                  console.log('\n');
                  console.log("FUTURE VALUES");
                  console.log(results[results.length - 5]);
                  console.log('\n');
                  console.log("MODEL ACCURACY - REAL VALUES");
                  console.log(results[results.length - 4]);
                  console.log('\n');
                  console.log("MODEL ACCURACY - PREDICTED VALUES");
                  console.log(results[results.length - 3]);
                  console.log('\n');
                  console.log("DATE USED FOR ACCURACY COMPARISON - FROM");
                  console.log(results[results.length - 2]);
                  console.log('\n');
                  console.log("DATE USED FOR ACCURACY COMPARISON - TO");
                  console.log(results[results.length - 1]);
                  console.log('\n');
                  // console.log(results[2].substring(2, results[2].length-2));
                  myResolve({
                    success: true,
                    // results: results[results.length-1],
                    results: results,
                    
                  }); // when successful
                });
        
                // myReject();  // when error
              });
        
              if (success) {
                res.json({
                  status: true,
                  message: "Time series data for 10 steps",
                  errors: [],
                  data: {
                    time_series: results,
                    steps: 10
                    // satellite_data: data,
                    // predicted_chl: results,
                    // calculated_vars: {b443:res_array[0][0],w:res_array[0][1],R443:res_array[0][2],r443:res_array[0][3],a443:res_array[0][4],aw443:res_array[0][5],bw443:res_array[0][6]},
                  },
                });
              } else {
                console.log("Test Error: " + err);
                // return;
                res.json({
                  status: false,
                  message: "Welcome to Tirtham",
                  errors: [er],
                  data: {
                    
                  },
                });
              }
          });
          
        }
      }
    }else{
      res.json({
        status: false,
        message: "No image found",
        errors: ["No image found"],
        data: {
        },
      });
    }
    }
    
  );
} catch (error) {
  res.json({
    status: false,
    message: "Welcome to Tirtham",
    errors: [error],
    data: {
    },
  });
}
}

const autoTimeSeries = async (index) => {
  const loc = await Location.findOne({uuid: index});
  // console.log(loc);
  const lat = loc.lat;
  const long = loc.long;
  // console.log('lat long');
  // console.log(lat);
  // console.log(long);
  
  const today = new Date();
  const yyyy = today.getFullYear();
  let mm = today.getMonth() + 1; // Months start at 0!
  let dd = today.getDate();

  if (dd < 10) dd = '0' + dd;
  if (mm < 10) mm = '0' + mm;

  const formattedToday = yyyy + '-' + mm + '-' + dd;
  // console.log(req.body.lat);
  // console.log(req.body.long);
  function bufferPoints(radius, bounds) {
    return function (pt) {
      pt = ee.Feature(pt);
      return bounds ? pt.buffer(radius).bounds() : pt.buffer(radius);
    };
  }

  const zonalStats = async (ic, fc, params) => {
    // Initialize internal params dictionary.
    var _params = {
      reducer: ee.Reducer.mean(),
      scale: null,
      crs: null,
      bands: null,
      bandsRename: null,
      imgProps: null,
      imgPropsRename: null,
      datetimeName: "datetime",
      datetimeFormat: "YYYY-MM-dd HH:mm:ss",
    };

    // Replace initialized params with provided params.
    if (params) {
      for (var param in params) {
        _params[param] = params[param] || _params[param];
      }
    }

    // Set default parameters based on an image representative.
    var imgRep = ic.first();
    // console.log(convert(imgRep));
    var nonSystemImgProps = ee
      .Feature(null)
      .copyProperties(imgRep)
      .propertyNames();
    if (!_params.bands) _params.bands = imgRep.bandNames();
    if (!_params.bandsRename) _params.bandsRename = _params.bands;
    if (!_params.imgProps) _params.imgProps = nonSystemImgProps;
    if (!_params.imgPropsRename) _params.imgPropsRename = _params.imgProps;

    // Map the reduceRegions function over the image collection.
    var results = await ic
      .map(function (img) {
        // Select bands (optionally rename), set a datetime & timestamp property.
        img = ee
          .Image(img.select(_params.bands, _params.bandsRename).divide(3.6e6))
          .set(_params.datetimeName, img.date().format(_params.datetimeFormat))
          .set("timestamp", img.get("system:time_start"));

        // Define final image property dictionary to set in output features.
        var propsFrom = ee
          .List(_params.imgProps)
          .cat(ee.List([_params.datetimeName, "timestamp"]));
        var propsTo = ee
          .List(_params.imgPropsRename)
          .cat(ee.List([_params.datetimeName, "timestamp"]));
        // var imgProps = img.toDictionary(propsFrom).rename(propsFrom, propsTo);
        var imgProps = img.toDictionary(propsFrom);

        // Subset points that intersect the given image.
        var fcSub = fc.filterBounds(img.geometry());

        // Reduce the image by regions.
        return (
          img
            .reduceRegions({
              collection: fcSub,
              reducer: _params.reducer,
              scale: _params.scale,
              crs: _params.crs,
            })
            // Add metadata to each feature.
            .map(function (f) {
              return f.set(imgProps);
            })
        );
      })
      .flatten()
      .filter(ee.Filter.notNull(_params.bandsRename));

    // console.log(results);
    return results;
  };

  var pts = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Point([parseFloat(long),parseFloat(lat)]), {
      plot_id: 1,
    }),
    // ee.Feature(ee.Geometry.Point([parseFloat(req.body.long-0.02), parseFloat(req.body.lat-0.0002)]), {plot_id: 2}),
    // ee.Feature(ee.Geometry.Point([parseFloat(req.body.long+0.02), parseFloat(req.body.lat+0.0002)]), {plot_id: 3}),
    // ee.Feature(ee.Geometry.Point([parseFloat(req.body.long-0.02), parseFloat(req.body.lat+0.0002)]), {plot_id: 4}),
    // ee.Feature(ee.Geometry.Point([parseFloat(req.body.long+0.02), parseFloat(req.body.lat-0.0002)]), {plot_id: 5})
  ]);

  function fmask(img) {
    var cloudShadowBitMask = 1 << 3;
    var cloudsBitMask = 1 << 5;
    var qa = img.select("QA_PIXEL");
    var mask = qa
      .bitwiseAnd(cloudShadowBitMask)
      .eq(0)
      .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
    return img.updateMask(mask);
  }

  function renameOli(img) {
    return img.select(
      ["SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B6", "SR_B7"],
      ["Blue", "Green", "Red", "NIR", "SWIR1", "SWIR2"]
    );
  }

  // Selects and renames bands of interest for TM/ETM+.
  function renameEtm(img) {
    return img.select(
      ["B1", "B2", "B3", "B4", "B5", "B7"],
      ["Blue", "Green", "Red", "NIR", "SWIR1", "SWIR2"]
    );
  }

  // Prepares (cloud masks and renames) OLI images.
  function prepOli(img) {
    // img = fmask(img);
    // img = renameOli(img);
    return img;
  }

  // Prepares (cloud masks and renames) TM/ETM+ images.
  function prepEtm(img) {
    // img = fmask(img);
    // img = renameEtm(img);
    return img;
  }

  var ptsLandsat = pts.map(bufferPoints(15, true));

  var oliCol = ee
    .ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .filterDate("2017-01-01", formattedToday)
    .filterBounds(ptsLandsat);
  // .map(prepOli);
  // console.log(convert(oliCol));
  // var etmCol = ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')
  //   .filterBounds(ptsLandsat)
  //   .map(prepEtm);

  // var tmCol = ee.ImageCollection('LANDSAT/LT05/C01/T1_SR')
  //   .filterBounds(ptsLandsat)
  //   .map(prepEtm);

  // var landsatCol = oliCol.merge(etmCol).merge(tmCol);

  var params = {
    reducer: ee.Reducer.mean(),
    scale: 30,
    crs: "EPSG:5070",
    // bands: ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2'],
    bands: ["SR_B1", "SR_B2", "SR_B3", "SR_B4"],
    // bandsRename: ["ls_blue", "ls_green", "ls_red"],
    bandsRename: ["R443", "R488", "R550", "R667"],
    // imgProps: ['LANDSAT_ID', 'SATELLITE'],
    // imgPropsRename: ['img_id', 'satellite'],
    datetimeName: "date",
    datetimeFormat: "YYYY-MM-dd",
  };

  // Extract zonal statistics per point per image.
  var ptsLandsatStats = zonalStats(oliCol, ptsLandsat, params).then(
    async (result) => {
      // console.log(convert(result).features);
      var data1 = convert(result).features;
      var data1 = Array.from(data1);
      // [
      //   bw(W) + bbp(W, bbp_B0, R443, R550),
      //   W,
      //   R443,
      //   rrs(R443),
      //   a(440, R443, bbp_B0, R443, R550),
      //   aw(W),
      //   bw(W),
      // ];
      console.log('for loop start');
      const toSaveNonSplit = data1.map(element => element.properties);
      let toSave = [];
      for (let index = 0; index < toSaveNonSplit.length-1; index++) {
        if(new Date(toSaveNonSplit[index]['date']) > new Date(toSaveNonSplit[index+1]['date'])) {
          break;
        } else {
          toSave.push(toSaveNonSplit[index]);
        }
      }
      for (let index2 = 0; index2 < toSave.length; index2++) {
        // const element = toSave[index];
        // let obj = element.properties;
        const calc =  await calculate(
              parseFloat(toSave[index2]["R443"]) * 1,
              parseFloat(toSave[index2]["R443"]) * 1,
              parseFloat(toSave[index2]["R488"]) * 1,
              parseFloat(toSave[index2]["R550"]) * 1,
              parseFloat(toSave[index2]["R667"]) * 1
            );
        toSave[index2]['bb'] = calc[0];
        toSave[index2]['W'] = calc[1];
        toSave[index2]['Rrs'] = calc[2];
        toSave[index2]['rrs'] = calc[3];
        toSave[index2]['a'] = calc[4];
        toSave[index2]['aw'] = calc[5];
        toSave[index2]['bw'] = calc[6];

        if(index2 == toSave.length-1) {
          // console.log(toSave);
          const jsonContent = JSON.stringify(toSave);
          // console.log(jsonContent);
          fs.writeFile(`file_${index}.json`, jsonContent, 'utf8', async function (err) {
              if (err) {
                  return console.log(err);
              }
              console.log("The file was saved!");

              let options = {
                mode: "text",
                // pythonPath: 'path/to/python',
                pythonOptions: ["-u"], // get print results in real-time
                scriptPath: "./controllers",
                args: [`file_${index}.json`],
              };
            const {
                success,
                er = "",
                results,
              } = await new Promise(function (myResolve, myReject) {
                // "Producing Code" (May take some time)
                PythonShell.run("xtimeseries2.py", options, function (errr, results) {
                  if (errr) {
                    console.log(errr);
                    myReject({ success: false, errr });
                  }
                  // results is an array consisting of messages collected during execution
                  // console.log(err);
                  // console.log('results');
                  console.log(results);
                  // console.log(results[2].substring(2, results[2].length-2));
                  myResolve({
                    success: true,
                    // results: results[results.length-1],
                    results: results,
                    
                  }); // when successful
                });
        
                // myReject();  // when error
              });
        
              if (success) {
                // res.json({
                //   status: true,
                //   message: "Time series data for 10 steps",
                //   errors: [],
                //   data: {
                //     time_series: results,
                //     steps: 10
                //     // satellite_data: data,
                //     // predicted_chl: results,
                //     // calculated_vars: {b443:res_array[0][0],w:res_array[0][1],R443:res_array[0][2],r443:res_array[0][3],a443:res_array[0][4],aw443:res_array[0][5],bw443:res_array[0][6]},
                //   },
                // });
                let chl = [];
                const date_arr = results[results.length-2].trim().split(" ");
                const chl_arr = results[results.length-1].trim().split(" ");
                chl.push({
                  date: results[results.length-4],
                  value: results[results.length-3]
                })
                for (let i = 0; i < chl_arr.length; i++) {
                  chl.push({
                    date: date_arr[i],
                    value: chl_arr[i]
                  })
                }

                if(chl[1].value < chl[2].value){
                  await sendNotification('Chlorophyll rising alert!', `C value at ${loc.name} is expected to reach ${chl[2].value} by ${chl[2].date}`);
                }
                loc.chl = chl;
                loc.updated_on = (new Date()).toLocaleString();
                await loc.save();
                console.log("Location: " + loc.uuid + " saved");
              } else {
                console.log("Test Error: " + err);
                // return;
                // res.json({
                //   status: false,
                //   message: "Welcome to Tirtham",
                //   errors: [er],
                //   data: {
                    
                //   },
                // });
                return -1;
              }
          });
          
        }
      }
      
    }
  );
}

const fetchGanga = async (req, res) => {
  try {
    const data = await Location.find({});
  res.json({
      status: true,
      message: "Welcome to Tirtham",
      errors: [],
      data: data,
    });
  } catch (error) {
    res.json({
      status: false,
      message: "Welcome to Tirtham",
      errors: [error],
      data: {},
    })
  }
  
}

const addFCM = async (req,res) =>{
  const tok = req.body.token;
  const available = await Token.find({token: tok});  
  if(available.length == 0) {
    const newToken = new Token({token:tok});
    await newToken.save();
  }
  res.json({
    status: true,
    message: "Token saved successfully",
    errors: [],
    data: {},
  });
}

const sendNotification = async (title, body) =>{

  const notification_options = {
    priority: "high",
    timeToLive: 60 * 60 * 24
  };

  const tokens = await Token.find({});
  // console.log(tokens);
  const arr = tokens.map(element => element.token);
  // console.log(arr);

  const message = {
    // data: {score: '850', time: '2:45'},
    tokens: arr,
    notification: {title: title, body: body}
  };

  admin.messaging().sendMulticast(message)
    .then((response) => {
      console.log(response.successCount + ' messages were sent successfully');
    });
}

module.exports = {
  index,
  mapid,
  getReflectanceLandsat,
  getReflectanceModis,
  runCalculate,
  // extractDataLandsat,
  timeSeries,
  autoTimeSeries,
  fetchGanga,
  addFCM,
  sendNotification
};
