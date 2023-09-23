import xgboost as xgb
import sys
import numpy as np
m = xgb.XGBRegressor()
m.load_model('./Rrs.json')
# print(float(sys.argv[1].strip("\"[")))
r = (sys.argv[1])
# print(r)
y = m.predict(np.array([float(r)]))
print(y[0])   
