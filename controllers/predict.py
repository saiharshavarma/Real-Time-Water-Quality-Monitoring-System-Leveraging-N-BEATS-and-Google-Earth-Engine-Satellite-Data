import warnings 
warnings.filterwarnings('ignore')
# import pickle
import sys
import tensorflow as tf
import statistics
import pickle
# with open(r"model.pkl", "rb") as input_file:
#   m = pickle.load(input_file)
# m = tf.keras.models.load_model('./model.pb')
import xgboost as xgb

m = xgb.XGBRegressor()
m.load_model('./xmodel.json')

# from load import m
l=[]
for i in range(1,len(sys.argv)):
  # sys.argv[i] = float(sys.argv[i])
  res = sys.argv[i].strip('\'').split(',')
  for j in range(len(res)):
    res[j] = float(res[j])
  # print(sys.argv[i],res)
  l.append(res)

# print(l)
sc = pickle.load(open('./scaler.pkl','rb'))
# l=[[0.107,440.0,0.00238,0.0045416,2.2,0.00635,0.002448]]
X_scaled = sc.transform(l)

res = m.predict(X_scaled)
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