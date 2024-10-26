<template>
  <div class="DependencyGraph" style="position: relative;">
    <div id="network" style="width: 100vw; height: 100vh;"></div>
    <div style="position: fixed; left: 5%; bottom: 10px; display: flex; align-items: center;">
      <div>
        <input type="range" id="zoomSlider" min="0.5" max="2" step="0.01" value="1" class="zoom-slider">
        <div id="zoomLabel" class="zoom-label">Zoom: 100%</div>
      </div>
      <button id="resetZoom" class="reset-zoom">Reset Zoom</button>
    </div>
  </div>
</template>

<style>
  .zoom-slider {
    width: 100%;
    height: 2px;
    border-radius: 5px;
    background: #ddd;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    position: relative;
  }

  .zoom-slider::-webkit-slider-thumb {
    width: 10px;
    height: 10px;
    background: #86898c;
    border-radius: 50%;
    cursor: pointer;
    -webkit-appearance: none;
  }

  .zoom-label {
    text-align: center;
    font-size: 10px;
    margin-top: 2px;
  }

  .reset-zoom {
    position: fixed;
    bottom: 10px;
    right: 2%;
    background-color: #005fb8;
    color: white;
    border: none;
    padding: 4px 8px;
    cursor: pointer;
    transition: transform 0.1s ease;
  }
  
  .reset-zoom:active {
    transform: scale(0.95);
  }
</style>

<script>
import cytoscape from "cytoscape";
import fcose from 'cytoscape-fcose'
import axios from "axios";
import { vscode } from "./utilities/vscode.ts";

export default {
  name: 'DependencyGraph',
  data() {
    return {
      projectName: "depends",
      data: [],
      entityRoot: [],
      parentIdMap: new Map(),
      entityIdMap: new Map(),
      relations: [],
      configData: {},
      type: "",
      packageList:[]
    }
  },
  created() {
    // this.getEntity()
    // this.getConfig()
    this.configData={
      "targetFilePath": "D:\\3Ere\\json-sample\\depends.enre.con.json",
        "projectRoot": "D:\\3Ere\\depends",
        "projectName": "depends",
    }
    //dependency,target
    this.type = 'dependency';
    this.getEntity()
  },
  mounted() {
    window.addEventListener('message', event => {
      const message = event.data; // The json data that the extension sent
      switch (message.command) {
        case 'setConfig':
          {
            console.log(message.configData);
            this.configData = JSON.parse(message.configData);
            this.type = message.type;
            this.getEntity()
            this.getArchModelData()
            break;
          }
      }
    })
  },
  methods: {
    getEntityCategory(node) {
      if (node["External"] === true) {
        return "External";
      }
      return node["category"];
    },
    getRelationCategory(cell) {
      for (const key of Object.keys(cell["values"])) {
        if (key === "loc" || key === "bindVar" || key === "modifyAccessible" || key === "invoke" || key === "arguments") {
          continue;
        }
        return key;
      }
      return undefined;
    },
    getRelationsByIds(entityIds) {
      const relations = []
      for (const cell of this.data["cells"]) {
        if (entityIds.has(cell["src"]) && entityIds.has(cell["dest"])) {
          relations.push(cell);
        }
      }
      // console.log("relations: ",relations);
      return relations;
    },
    //目标模型的cell加一个判断类型，把父子节点的边不显现。
    getRelationsByIdsTarget(entityIds) {
      // console.log(this.packageList)
      const relations = []
      for (const cell of this.data["cells"]) {
        // console.log('cell',cell)
        if (entityIds.has(cell["src"]) && entityIds.has(cell["dest"])) {
          let category='Relation'
          let cn=this.packageList.find(n=>n.id==cell["dest"]+'');
          if(cn.parentId==cell["src"]+''){
            category='Contain'
          }
          let pn=this.packageList.find(n=>n.id==cell["src"]+'');
          if(pn.parentId==cell["dest"]+''){
            category='Contain'
          }
          let c={src:cell["src"],dest:cell["dest"],category:category}
          relations.push(c);
        }
      }
      return relations;
    },
    getChildrenById(entityId) {
      if (!this.parentIdMap.has(entityId)) {
        return [];
      }
      return this.parentIdMap.get(entityId);
    },
    async buildVariableList(variables) {
      const nameIdMap = new Map();
      const resultList = [];
      variables.forEach((variable, i) => {
        nameIdMap.set(variable, i + 1);
        let parentId;
        if (!variable.includes("/")) {
          parentId = -1;
        } else {
          parentId = nameIdMap.get(variable.slice(0, variable.lastIndexOf("/")));
        }
        var name=variable.split('/')
        // console.log(name)
        resultList.push({
          "id": i + 1,
          "name": name[name.length-1],
          "qualifyName":variable,
          "parentId": parentId,
        });
      });
      return resultList;
    },
    async getArchModelData() {
      const params = JSON.stringify({
        "filePath": this.configData.targetFilePath,
        "rootDir": this.configData.projectRoot,
        "projectName": this.configData.projectName,
      });
      const config = {
        headers: {
          'Content-Type': 'application/json'
        }
      };
      const result = await axios.post('http://localhost:8888/target/upload', params, config);
      this.data = result.data.data;
      console.log(this.data);
      this.packageList = await this.buildVariableList(this.data["variables"]);
      this.packageList.forEach((variable) => {
        this.entityIdMap.set(variable.id, variable);
        if (!this.parentIdMap.has(variable.parentId)) {
          this.parentIdMap.set(variable.parentId, []);
        }
        this.parentIdMap.get(variable.parentId).push(variable);
      });
    },
    async getData() {
      const params = JSON.stringify({
        rootDir: this.configData.projectRoot,
        lang: "java",
        projectName: this.configData.projectName,
      })
      const config = {
        headers: {
          'Content-Type': 'application/json'
        }
      }
      const result = await axios.post('http://localhost:8888/extract/enre', params, config);
      this.data = result.data.data;
      console.log(this.data);
      for (const variable of this.data["variables"]) {
        this.entityIdMap.set(variable["id"], variable);
        if (!this.parentIdMap.has(variable["parentId"])) {
          this.parentIdMap.set(variable["parentId"], []);
        }
        this.parentIdMap.get(variable["parentId"]).push(variable);
      }
      vscode.postMessage({//向vscode插件通信
        command: "hello",
        text: "Dependendcy analysis finished",
        })
      },
    async getEntity() {
      if (this.type == 'dependency') await this.getData();
      else await this.getArchModelData();
      this.entityRoot = [];
      let edgesParam = new Set();
      const ref = this;
      this.entityRoot.push({group: 'nodes', data: {id: -1, name: this.projectName}})
      this.getChildrenById(-1).forEach((node) => {
        const cat = ref.getEntityCategory(node);
        this.entityRoot.push({
          group: 'nodes',
          data: {id: node["id"], name: node["name"], parent: -1, classes: 'center-center', category: cat}
        });
        edgesParam.add(node["id"]);
      })
      ref.getRelationsByIds(edgesParam).forEach((edge) => {
        const cat = ref.getRelationCategory(edge);
        if (cat !== 'Contain' && cat !== 'Define') {
          this.entityRoot.push({
            group: 'edges',
            data: {id: edge.id, source: String(edge["src"]), target: String(edge["dest"]), category: cat}
          });
        }
      });
      console.log("entityRoot: " + ref.entityRoot);
      cytoscape.use(fcose);
      let cy = cytoscape({
        container: document.getElementById('network'),
        ready: function () {
          this.nodes().forEach(function (node) {
            let size = 50;
            node.css("width", size);
            node.css("height", size);
          });

          // this.layout({name: 'fcose', fit: true, nodeRepulsion: 99999,initialEnergyOnIncremental: 0.1,nestingFactor:0.1, animationEasing: 'ease-out'}).run();
        },
        layout: {
          name: "fcose",
          fit: true,
          nodeRepulsion: 99999,
          animationDuration: 300,
          spacingFactor: 1.2,
          nodeDimensionsIncludeLabels: true,
          avoidOverlap: true,
        },
        zoomingEnabled: true,
        userZoomingEnabled: true,
        maxZoom: 2,
        minZoom: 0.5,
        style: [
          {
            selector: 'node',
            style:ref.type=='dependency'? {
              'label': 'data(name)',
              'font-size': '14px',
              'background-opacity': 0.6,
              'background-color': '#2B65EC'
            }: {
              'label': 'data(name)',
              'font-size': '14px',
              'background-opacity': 0.6,
              'background-color': '#2B65EC',
              "shape": "cut-rectangle",
            }
          },
          {
            selector: '[category = "Package"]',
            style: {
              'label': 'data(name)',
              'font-size': '14px',
              'background-opacity': 0.6,
              'background-color': '#2B65EC',
              "shape": "cut-rectangle",
            }
          },
          {
            selector: ':parent',
            style: {
              'background-opacity': 0.2,
              'border-color': '#62f'
            }
          },

          {
            selector: 'edge',
            style: {
              'label': 'data(category)',
              'line-color': '#2B65EC',
              'target-arrow-color': '#2B65EC',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier'
            }
          },

          {
            selector: 'node:selected',
            style: {
              'background-color': '#F08080',
              'border-color': 'red'
            }
          },

          {
            selector: 'edge:selected',
            style: {
              'line-color': '#F08080'
            }
          }
        ],
        elements: this.entityRoot,
      });
      // 监听滑块变化并更新缩放级别
      let zoomSlider = document.getElementById('zoomSlider');
      let zoomLabel = document.getElementById('zoomLabel');
      let resetZoomButton = document.getElementById('resetZoom');

      function updateZoom() {
        let zoomLevel = parseFloat(zoomSlider.value);
        cy.zoom({ level: zoomLevel });
        zoomLabel.textContent = `Zoom: ${Math.round(zoomLevel * 100)}%`;
      }

      function syncZoom() {
        let zoomLevel = cy.zoom();
        zoomSlider.value = zoomLevel;
        zoomLabel.textContent = `Zoom: ${Math.round(zoomLevel * 100)}%`;
      }

      function resetZoom() {
        cy.fit(); // 适应所有节点到视图
      }

      zoomSlider.value = cy.zoom();
      syncZoom();
      zoomSlider.addEventListener('input', updateZoom);
      setInterval(syncZoom, 10); // 每 10 毫秒检查一次
      resetZoomButton.addEventListener('click', resetZoom);

      cy.center();
      cy.on('tap', 'node', function (evt) {
        let target = evt.target;
        // console.log("target: " + target);
        // console.dir(target);
        if (target.selected()) {
          target.children().forEach(ele => {
            cy.remove(ele)
          });
          cy.remove(target);
          cy.add(target)
        } else {
          let edgesParam = new Set();
          ref.getChildrenById(Number(target.id())).forEach((node) => {
            const cat = ref.getEntityCategory(node);
            cy.add({
              group: 'nodes',
              data: {id: node["id"], name: node["name"], parent: target.id(), classes: 'center-center', category: cat}
            })
          })
          cy.elements().forEach(ele => {
            edgesParam.add(Number(ele.data().id));
          });

          // 存储已存在的边的源和目标节点对
          let existingEdgePairs = new Set();

          // 添加现有图中边的源和目标节点对到集合中
          cy.edges().forEach(edge => {
              const source = edge.data().source;
              const target = edge.data().target;
              existingEdgePairs.add(`${source}-${target}`);
          });

          if (ref.type == 'target') {
              ref.getRelationsByIdsTarget(edgesParam).forEach((edge) => {
                  const cat = edge.category;
                  if (cat !== 'Contain' && cat !== 'Define') {
                      const source = String(edge["src"]);
                      const target = String(edge["dest"]);
                      const edgePair = `${source}-${target}`;
                      // 检查源和目标节点对是否已存在
                      if (!existingEdgePairs.has(edgePair)) {
                          cy.add({
                              group: 'edges',
                              data: { id: edge.id, source, target, category: edge.category }
                          });
                          // 将新的边的源和目标节点对添加到集合中
                          existingEdgePairs.add(edgePair);
                      }
                  }
              });
          } else {
              ref.getRelationsByIds(edgesParam).forEach((edge) => {
                  const cat = ref.getRelationCategory(edge);
                  if (cat !== 'Contain' && cat !== 'Define') {
                      const source = String(edge["src"]);
                      const target = String(edge["dest"]);
                      const edgePair = `${source}-${target}`;
                      // 检查源和目标节点对是否已存在
                      if (!existingEdgePairs.has(edgePair)) {
                          cy.add({
                              group: 'edges',
                              data: { id: edge.id, source, target, category: cat }
                          });
                          // 将新的边的源和目标节点对添加到集合中
                          existingEdgePairs.add(edgePair);
                      }
                  }
              });
          }
          console.log("existingEdgePairs: ", existingEdgePairs);

          let layout = cy.layout({
            name: "fcose",
            fit: true,
            nodeRepulsion: 99999,
            randomize: true,
            animationDuration: 300,
            padding: 30,
            nodeDimensionsIncludeLabels: true,
            initialEnergyOnIncremental: 0.5,
            nestingFactor: 0.5,
            spacingFactor: 1.2,
            avoidOverlap: true,
          })
          layout.run()
        }
      });
      cy.center();
    },
    async getConfig() {
          vscode.postMessage({
            command: 'setConfig'
          })
        }
      }
    }
</script>

<style lang="scss" scoped>
.title-header {
  margin: 1em 0 0.5em;
}

.over-view {
  width: max(50vw, 800px);
}

#network {
  width: 100%;
  //height: 100%;
  height: max(80vh, 800px);
  overflow: auto;
  border: 1px solid #69f;
}
</style>