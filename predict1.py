
# import pickle
import sys
import tensorflow as tf
# with open(r"model.pkl", "rb") as input_file:
#   m = pickle.load(input_file)
m = tf.keras.models.load_model('../model.pb')

# from load import m

for i in range(1,len(sys.argv)):
  sys.argv[i] = float(sys.argv[i])
  print(sys.argv[i])
res = m.predict([sys.argv[1:]])
# print(m)
# res = m.predict([[0.0035013571951045923,440.0,0.0029,0.00552454612,0.057438815952069316,0.00635000000000001,0.0024484]])
print(res)
# print(m.predict([sys.argv[1:]]))