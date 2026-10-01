# Imagen HDFS multi-arquitectura (funciona en Apple Silicon / arm64).
# Las imagenes oficiales de Hadoop solo publican amd64; por eso se construye
# sobre un JRE multi-arch y se descarga el tarball de Apache (Java es portable).
FROM eclipse-temurin:11-jre-jammy

ARG HADOOP_VERSION=3.3.6
ENV HADOOP_HOME=/opt/hadoop \
    HADOOP_CONF_DIR=/opt/hadoop/etc/hadoop \
    HDFS_NAMENODE_USER=root \
    HDFS_DATANODE_USER=root \
    PATH=/opt/hadoop/bin:/opt/hadoop/sbin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends curl procps \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL "https://archive.apache.org/dist/hadoop/common/hadoop-${HADOOP_VERSION}/hadoop-${HADOOP_VERSION}.tar.gz" \
    | tar -xz -C /opt \
 && mv /opt/hadoop-${HADOOP_VERSION} /opt/hadoop \
 && rm -rf /opt/hadoop/share/doc

COPY core-site.xml hdfs-site.xml $HADOOP_CONF_DIR/
COPY arrancar-hdfs.sh /usr/local/bin/arrancar-hdfs.sh
RUN chmod +x /usr/local/bin/arrancar-hdfs.sh

EXPOSE 8020 9870 9864
CMD ["/usr/local/bin/arrancar-hdfs.sh"]
