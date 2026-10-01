#!/usr/bin/env bash
set -e

# Formatea el NameNode solo la primera vez (el volumen persiste entre reinicios).
if [ ! -d /data/name/current ]; then
  echo "[hdfs] Formateando NameNode..."
  hdfs namenode -format -force -nonInteractive
fi

echo "[hdfs] Arrancando NameNode..."
hdfs namenode &
NN_PID=$!
sleep 12

echo "[hdfs] Arrancando DataNode..."
hdfs datanode &
DN_PID=$!
sleep 15

# Directorios base del data lake
hdfs dfs -mkdir -p /datalake/crudo /datalake/checkpoints || true
echo "[hdfs] Data lake listo en /datalake"

wait -n $NN_PID $DN_PID
