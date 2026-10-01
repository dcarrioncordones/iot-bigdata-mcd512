# Imagen de Spark construida sobre un JRE multi-arch + PySpark de PyPI.
# Se evita apache/spark porque sus tags no cubren arm64 de forma consistente.
FROM eclipse-temurin:17-jre-jammy

ARG SPARK_VERSION=3.5.1
ARG SCALA_VERSION=2.12

ENV PYSPARK_PYTHON=python3 \
    PYSPARK_DRIVER_PYTHON=python3 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip curl procps \
 && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir \
      pyspark==${SPARK_VERSION} \
      pandas==2.2.2 \
      numpy==1.26.4 \
      pyarrow==16.1.0 \
      scikit-learn==1.5.0 \
      joblib==1.4.2 \
      influxdb-client==1.44.0

ENV SPARK_HOME=/usr/local/lib/python3.10/dist-packages/pyspark
ENV PATH=$SPARK_HOME/bin:$PATH

# Conectores de Kafka empaquetados en la imagen (evita depender de --packages
# y de la descarga de Maven en cada arranque).
ARG MVN=https://repo1.maven.org/maven2
RUN set -e; cd $SPARK_HOME/jars; \
    curl -fsSLO $MVN/org/apache/spark/spark-sql-kafka-0-10_${SCALA_VERSION}/${SPARK_VERSION}/spark-sql-kafka-0-10_${SCALA_VERSION}-${SPARK_VERSION}.jar; \
    curl -fsSLO $MVN/org/apache/spark/spark-token-provider-kafka-0-10_${SCALA_VERSION}/${SPARK_VERSION}/spark-token-provider-kafka-0-10_${SCALA_VERSION}-${SPARK_VERSION}.jar; \
    curl -fsSLO $MVN/org/apache/kafka/kafka-clients/3.4.1/kafka-clients-3.4.1.jar; \
    curl -fsSLO $MVN/org/apache/commons/commons-pool2/2.11.1/commons-pool2-2.11.1.jar

WORKDIR /app
