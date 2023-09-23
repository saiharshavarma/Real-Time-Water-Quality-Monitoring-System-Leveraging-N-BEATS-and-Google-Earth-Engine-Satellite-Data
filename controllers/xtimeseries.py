# import pickle
# import sys
import pandas as pd
import numpy as np
# import matplotlib.pyplot as plt
# import seaborn as sns
import pickle

import xgboost as xgb
from sklearn.metrics import mean_squared_error
# color_pal = sns.color_palette()
# plt.style.use('fivethirtyeight')

import tensorflow as tf
# # import statistics
# import pandas as pd
# # import statsmodels as sm
# from statsmodels.tsa.api import VAR
import warnings 
warnings.filterwarnings('ignore')

# with open(r"model.pkl", "rb") as input_file:
#   m = pickle.load(input_file)
# m = tf.keras.models.load_model('./model.pb')
m = xgb.XGBRegressor()
m.load_model('./xmodel.json')
sc = pickle.load(open('./scaler.pkl','rb'))
# from load import m
data = pd.read_json('./file.json')
df = data[['bb','W','Rrs','rrs','a','aw','bw']]
c=[]
for i in range(len(df)):
  # print(list(pred_data.iloc[i]))
  # c.append(m.predict([list(df.iloc[i])],verbose=0)[0][0])
  X_scaled = sc.transform([list(df.iloc[i])])
  c.append(m.predict(X_scaled)[0])
df['C'] = c
df['date'] = data['date']
df = df.set_index('date')
df.index = pd.to_datetime(df.index)
# train = df.loc[df.index < '01-12-2022']
# test = df.loc[df.index >= '01-12-2022']
def create_features(df):
    """
    Create time series features based on time series index.
    """
    df = df.copy()
    df['hour'] = df.index.hour
    df['dayofweek'] = df.index.dayofweek
    df['quarter'] = df.index.quarter
    df['month'] = df.index.month
    df['year'] = df.index.year
    df['dayofyear'] = df.index.dayofyear
    df['dayofmonth'] = df.index.day
    df['weekofyear'] = df.index.isocalendar().week
    return df
df = create_features(df)

def add_lags(df):
    target_map = df['C'].to_dict()
    df['lag1'] = (df.index - pd.Timedelta('368 days')).map(target_map)
    df['lag2'] = (df.index - pd.Timedelta('736 days')).map(target_map)
    df['lag3'] = (df.index - pd.Timedelta('1104 days')).map(target_map)
    return df
df = add_lags(df)
# train = create_features(train)
# test = create_features(test)

# FEATURES = ['bb','Rrs','a','dayofyear', 'dayofweek', 'year']
FEATURES = ['dayofyear', 'hour', 'dayofweek', 'quarter', 'month', 'year', 'lag1','lag2','lag3']
TARGET = 'C'

X_train = df[FEATURES]
y_train = df[TARGET]

# X_test = test[FEATURES]
# y_test = test[TARGET]

reg = xgb.XGBRegressor(base_score=0.5, booster='gbtree',    
                      #  n_estimators=1000,
                       n_estimators=500,
                       early_stopping_rounds=50,
                       objective='reg:squarederror',
                       max_depth=10,
                       learning_rate=0.01)
reg.fit(X_train, y_train,
        eval_set=[(X_train, y_train)],
        verbose=0)

# 1----------------
# fi = pd.DataFrame(data=reg.feature_importances_,
#              index=reg.feature_names_in_,
#              columns=['importance'])
# fi.sort_values('importance').plot(kind='barh', title='Feature Importance')
# plt.show()
# test['prediction'] = reg.predict(X_test)
# df = df.merge(test[['prediction']], how='left', left_index=True, right_index=True)
# ax = df[['C']].plot(figsize=(15, 5))
# df['prediction'].plot(ax=ax, style='.')
# plt.legend(['Truth Data', 'Predictions'])
# ax.set_title('Raw Dat and Prediction')
# plt.show()


# 2 --------------------------
from datetime import datetime
from dateutil.relativedelta import relativedelta

d = datetime.now().strftime("%Y-%m-%d")

# print(df.index.max())
d2 = datetime.now() + relativedelta(days=146)
future = pd.date_range(d,d2, freq='16d')
# print(future)
future_df = pd.DataFrame(index=future)
future_df['isFuture'] = True
df['isFuture'] = False
df_and_future = pd.concat([df, future_df])
df_and_future = create_features(df_and_future)
df_and_future = add_lags(df_and_future)

future_w_features = df_and_future.query('isFuture').copy()
future_w_features['pred'] = reg.predict(future_w_features[FEATURES])
# print(future_w_features)
for x in list(future_w_features['pred']):
  print(x,end=" ")
# future_w_features['pred'].plot(figsize=(10, 5),
#                                color=color_pal[4],
#                               #  ms=1,
#                               #  lw=1,
#                                title='Future Predictions')
# plt.show()
# print(future_w_features)


# 3 --------------------------

# future_w_features = df.loc[df.index >= '01-11-2022'].copy()
# future_w_features['pred'] = reg.predict(future_w_features[FEATURES])
# ax = future_w_features[['C']].plot(figsize=(15, 5))
# future_w_features['pred'].plot(ax=ax)
# plt.legend(['Truth Data', 'Predictions'])
# ax.set_title('Raw Dat and Prediction')
# plt.show()




# model accuracy ------------------
# df2 = df.loc[df.index < (datetime.now() - relativedelta(months=3)).strftime("%d-%m-%Y")].copy()
df2 = df.loc[df.index < (df.index.max() - relativedelta(months=3)).strftime("%Y-%m-%d")].copy()
# print(df2.info())
X_train2 = df2[FEATURES]
y_train2 = df2[TARGET]

reg2 = xgb.XGBRegressor(base_score=0.5, booster='gbtree',    
                      #  n_estimators=1000,
                       n_estimators=500,
                       early_stopping_rounds=50,
                       objective='reg:squarederror',
                       max_depth=10,
                       learning_rate=0.01)
reg2.fit(X_train2, y_train2,
        eval_set=[(X_train2, y_train2)],
        verbose=0)

# df_last_month = df.loc[df.index >= (datetime.now() - relativedelta(months=3)).strftime("%d-%m-%Y")].copy()
df_last_month = df.loc[df.index >= (df.index.max() - relativedelta(months=3)).strftime("%Y-%m-%d")].copy()
# print(datetime.now() - relativedelta(months=1))
# print((datetime.now() - relativedelta(months=1)).strftime("%d-%m-%Y"))
df_last_month['pred'] = reg2.predict(df_last_month[FEATURES])
print()
for x in list(df_last_month['C']):
  print(x,end=" ")
print()
for x in list(df_last_month['pred']):
  print(x,end=" ")

print()
print(df_last_month.index.min())
print(d)

# old -----------------------
# import numpy as np
# # model = sm.tsa.api.VAR(np.array(df[['C','Rrs','rrs','bb','a']]))
# model = VAR(np.array(df[['C','Rrs','rrs','bb','a']]))
# # model = sm.tsa.vector_ar.var_model.VAR(np.array(df[['C','Rrs','rrs','bb','a']]))
# results = model.fit(maxlags=10, ic='aic')
# print(results.summary())
# # print('np array')
# # print(np.array(df[['C','Rrs','rrs','bb','a']]))
# # print('np array end')
# forecast=[]
# # try:
# forecast = results.forecast(np.array(df[['C','Rrs','rrs','bb','a']]),steps=10)
# # except Exception as e:
# # print(e)
# if len(forecast) != 0:
#   for i in forecast:
#     print(' '.join([str(elem) for elem in list(i)]))
