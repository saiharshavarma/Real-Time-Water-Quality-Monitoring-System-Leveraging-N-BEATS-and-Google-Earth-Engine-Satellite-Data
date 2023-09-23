const wv = require("./wv_aw_bw.json");
const wv_data = JSON.parse(wv);

const rrs = (R) => {
return R / (0.52 + 1.7 * R);
};

const u = (rrs) => {
let g0 = 0.089;
let g1 = 0.1245;
return (-g0 + Math.pow(Math.pow(g0, 2) + 4 * g1 * rrs, 0.5)) / (2 * g1);
};

const bbp = (W, bbp_B0, R443, R550) => {
let B0 = 560;
let e = Math.exp((-0.9 * rrs(R443)) / rrs(R550));
let g = 2.0 * (1 - 1.2 * e);
return bbp_B0 * Math.pow(B0 / W, g);
};

const a = (W, Rrs, bbp_B0, R443, R550) => {
const bb = bw(W) + bbp(W, bbp_B0, R443, R550);
console.log("a at "+W+" "+((1 - u(rrs(Rrs))) * bb) / u(rrs(Rrs)));
console.log("bb at "+W+" "+(bw(W) + bbp(W, bbp_B0, R443, R550)));
console.log("bbp at "+W+" "+(bbp(W, bbp_B0, R443, R550)));
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
let p1 = rrs(R443) + rrs(R488);
let p2 = rrs(R550) + 5 * (rrs(R667) / rrs(R488)) * rrs(R667);
let x = Math.log10(p1 / p2);
let h0 = -1.146;
let h1 = -1.366;
let h2 = -0.469;

a_550 = aw(560) + Math.pow(10, h0 + h1 * x + h2 * Math.pow(x, 2));
console.log("a at 550",a_550);
let bbp_B0 = (u(rrs(R550)) * a_550) / (1 - u(rrs(R550))) - bw(560);
console.log("BBP at 550",bbp_B0);
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
let adg_410 = adg443 * Math.exp(-S * (410 - 440));
let adg_550 = adg443 * Math.exp(-S * (550 - 440));
console.log("ADG at 440",adg)
console.log("ADG at 410",adg_410)
console.log("ADG at 550",adg_550)
let aph = a(W, R, bbp_B0, R443, R550) - adg - aw(W);
let aph_410 = a(410, R, bbp_B0, R443, R550) - adg_410 - aw(410);
let aph_550 = a(550, R, bbp_B0, R443, R550) - adg_550 - aw(550);
console.log("APH at 440",aph)
console.log("APH at 410",aph_410)
console.log("APH at 550",aph_550)
let chl_a = Math.pow(aph/0.05,1/0.626);
console.log("CHLOROPHYLL  "+chl_a);

};

calculate(0.0010977,0.001546,0.0031487,0.0061789,0.0023564)
console.log("rrs at 410 ",rrs(0.0010977))
console.log("rrs at 440 ",rrs(0.001546))
console.log("rrs at 550 ",rrs(0.0061789))