import warnings 
warnings.filterwarnings('ignore')
import pandas as pd
import tensorflow as tf
from darts.dataprocessing.transformers import Scaler
from pandas.core.common import random_state
from darts import TimeSeries
from darts.models import NBEATSModel
from darts.metrics import mape, smape
import xgboost as xgb
import pickle
data = pd.read_json('./file.json')
m = xgb.XGBRegressor()
m.load_model('./xmodel.json')
pred_data = data[['bb','W','Rrs','rrs','a','aw','bw']]
sc = pickle.load(open('./scaler.pkl','rb'))
c=[]
for i in range(len(data)):
  # print(list(pred_data.iloc[i]))
  # c.append(m.predict([list(df.iloc[i])],verbose=0)[0][0])
  X_scaled = sc.transform([list(pred_data.iloc[i])])
  c.append(m.predict(X_scaled)[0])

pred_data['C'] = c
pred_data['date'] = data['date']

df = pred_data[['bb','a','C','Rrs','rrs','date']]
df = df.set_index('date')
scalar_c = Scaler()
series_c = scalar_c.fit_transform(TimeSeries.from_series(df["C"],fill_missing_dates=True,freq="16d",fillna_value=df.mean()['C']) )
# train_c, test_c = series_c[:100], series_c[100:]
model_nb = NBEATSModel(input_chunk_length=7, output_chunk_length=1, n_epochs=10, random_state=21)
model_nb.fit([series_c], verbose=0)
pred_c = model_nb.predict(n=10, series=series_c)
pred_c_inv = scalar_c.inverse_transform(pred_c)

# print(list(pred_c_inv.pd_dataframe()['C']))


from datetime import datetime
from dateutil.relativedelta import relativedelta

# d = datetime.now().strftime("%Y-%m-%d")
# # print(df.index.max())
# d2 = datetime.now() + relativedelta(days=146)
# future = pd.date_range(d,d2, freq='16d')
# print(future)
# future_df = pd.DataFrame(index=future)
# future_df['isFuture'] = True
# df['isFuture'] = False
# df_and_future = pd.concat([df, future_df])
# df_and_future = create_features(df_and_future)
# df_and_future = add_lags(df_and_future)

# future_w_features = df_and_future.query('isFuture').copy()
# future_w_features['pred'] = reg.predict(future_w_features[FEATURES])
# print(future_w_features)
# for x in list(future_w_features['pred']):
#   print(x,end=" ")
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
# print(df.index)
df2 = df.loc[df.index < (df.index.max() - relativedelta(months=3)).strftime("%Y-%m-%d")].copy()
df_last_month = df.loc[df.index >= (df.index.max() - relativedelta(months=3)).strftime("%Y-%m-%d")].copy()
# # print(df2.info())
# X_train2 = df2[FEATURES]
# y_train2 = df2[TARGET]
series_c_last_month = scalar_c.fit_transform(TimeSeries.from_series(df2["C"],fill_missing_dates=True,freq="16d",fillna_value=df.mean()['C']) )
# train_c, test_c = series_c[:100], series_c[100:]
model_nb = NBEATSModel(input_chunk_length=7, output_chunk_length=1, n_epochs=10, random_state=21)
model_nb.fit([series_c_last_month], verbose=0)
pred_c_last_month = model_nb.predict(n=df_last_month.shape[0], series=series_c_last_month)
pred_c_inv_last_month = scalar_c.inverse_transform(pred_c_last_month)

# print(list(pred_c_inv.pd_dataframe()['C']))
# reg2 = xgb.XGBRegressor(base_score=0.5, booster='gbtree',    
#                       #  n_estimators=1000,
#                        n_estimators=500,
#                        early_stopping_rounds=50,
#                        objective='reg:squarederror',
#                        max_depth=10,
#                        learning_rate=0.01)
# reg2.fit(X_train2, y_train2,
#         eval_set=[(X_train2, y_train2)],
#         verbose=0)

# df_last_month = df.loc[df.index >= (datetime.now() - relativedelta(months=3)).strftime("%d-%m-%Y")].copy()

# print(datetime.now() - relativedelta(months=1))
# print((datetime.now() - relativedelta(months=1)).strftime("%d-%m-%Y"))
# df_last_month['pred'] = reg2.predict(df_last_month[FEATURES])
# PRINTING -------------------------------------------------------
print()
for x in list(pred_c_inv.pd_dataframe()['C']):
    print(x,end=" ")

print()
for x in list(df_last_month['C']):
  print(x,end=" ")

print()
for x in list(pred_c_inv_last_month.pd_dataframe()['C']):
    print(x,end=" ")
# for x in list(df_last_month['C']):
#   print(x,end=" ")


print()
print(df_last_month.index.min())
print(pred_c_inv.pd_dataframe().index.min())