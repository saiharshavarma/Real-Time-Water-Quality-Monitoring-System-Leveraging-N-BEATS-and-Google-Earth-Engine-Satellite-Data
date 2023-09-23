# import pickle
# import sys
import tensorflow as tf
# import statistics
import pandas as pd
# import statsmodels as sm
from statsmodels.tsa.api import VAR
import warnings 
warnings.filterwarnings('ignore')

# with open(r"model.pkl", "rb") as input_file:
#   m = pickle.load(input_file)
m = tf.keras.models.load_model('./model.pb')
# from load import m
data = pd.read_json('./file.json')
df = data[['bb','W','Rrs','rrs','a','aw','bw']]
c=[]
for i in range(len(df)):
  # print(list(pred_data.iloc[i]))
  c.append(m.predict([list(df.iloc[i])],verbose=0)[0][0])
df['C'] = c
df['date'] = data['date']

import numpy as np
# model = sm.tsa.api.VAR(np.array(df[['C','Rrs','rrs','bb','a']]))
model = VAR(np.array(df[['C','Rrs','rrs','bb','a']]))
# model = sm.tsa.vector_ar.var_model.VAR(np.array(df[['C','Rrs','rrs','bb','a']]))
results = model.fit(maxlags=10, ic='aic')
# print(results.summary())
# print('np array')
# print(np.array(df[['C','Rrs','rrs','bb','a']]))
# print('np array end')
forecast=[]
# try:
forecast = results.forecast(np.array(df[['C','Rrs','rrs','bb','a']]),steps=10)
# except Exception as e:
# print(e)
if len(forecast) != 0:
  for i in forecast:
    print(' '.join([str(elem) for elem in list(i)]))
