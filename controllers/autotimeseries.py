
import pandas as pd
import tensorflow as tf
from darts.dataprocessing.transformers import Scaler
from pandas.core.common import random_state
from darts import TimeSeries
from darts.models import NBEATSModel
from darts.metrics import mape, smape

data = pd.read_json('../ganga.json')
m = tf.keras.models.load_model('../model.pb')
pred_data = data[['bb','W','Rrs','rrs','a','aw','bw']]

c=[]
for i in range(pred_data.shape[0]):
  # print(list(pred_data.iloc[i]))
  c.append(m.predict([list(pred_data.iloc[i])])[0][0])

pred_data['C'] = c
pred_data['date'] = data['date']

df2 = pred_data[['bb','a','C','Rrs','rrs']]

scalar_c = Scaler()
series_c = scalar_c.fit_transform(TimeSeries.from_series(df2["C"],fill_missing_dates=True,freq="16D",fillna_value=df2.mean()['C']) )
# train_c, test_c = series_c[:100], series_c[100:]
model_nb = NBEATSModel(input_chunk_length=7, output_chunk_length=1, n_epochs=100, random_state=21)
model_nb.fit([series_c], verbose=True)
pred_c = model_nb.predict(n=10, series=series_c)
pred_c_inv = scalar_c.inverse_transform(pred_c)

print(list(pred_c_inv.pd_dataframe()['C']))
