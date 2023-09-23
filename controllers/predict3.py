import warnings 
warnings.filterwarnings('ignore')
# import pickle
import sys
import tensorflow as tf
import statistics
import pickle
import numpy as np
# with open(r"model.pkl", "rb") as input_file:
#   m = pickle.load(input_file)
# m = tf.keras.models.load_model('./model.pb')
import xgboost as xgb

m = xgb.XGBRegressor()
m.load_model('./xgbHA.json')

m_ag = xgb.XGBRegressor()
m_ag.load_model('./a_g.json')

m_bb_dm = xgb.XGBRegressor()
m_bb_dm.load_model('./bb_dm.json')

# from load import m
l=[]
for i in range(1,len(sys.argv)):
  # sys.argv[i] = float(sys.argv[i])
  res = sys.argv[i].strip('\'').split(',')
  for j in range(len(res)):
    res[j] = float(res[j])
  # print(sys.argv[i],res)
  adg_443, bbp_443 = res[-2], res[-1]
  res = res[:-2]
  res.append(m_bb_dm.predict(np.array([[bbp_443,res[0]]]))[0])
  res.append(m_ag.predict(np.array([adg_443]))[0])
  l.append(res)

print(l)

# sc = pickle.load(open('./scaler.pkl','rb'))
# l=[[0.107,440.0,0.00238,0.0045416,2.2,0.00635,0.002448]]
# X_scaled = sc.transform(l)

# res = m.predict(X_scaled)
res = m.predict(np.array(l))
# print(res)
# res = m.predict([[0.0035013571951045923,440.0,0.0029,0.00552454612,0.057438815952069316,0.00635000000000001,0.0024484]])
# mn =[]
# for x in res:
#   mn.append(x[0])
# print(mn)
for x in list(res):
  print(x)
print(statistics.median(list(res)))
# print(sum(mn)/len(mn))
# print(m.predict([sys.argv[1:]]))