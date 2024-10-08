import { app } from "/scripts/app.js";
import { fabric } from "./fabric.js";
import { api } from "/scripts/api.js";

fabric.Object.prototype.transparentCorners = false;
fabric.Object.prototype.cornerColor = "#108ce6";
fabric.Object.prototype.borderColor = "#108ce6";
fabric.Object.prototype.cornerSize = 10;

let connect_keypoints = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [1, 5],
    [5, 6],
    [6, 7],
    [1, 8],
    [8, 9],
    [9, 10],
    [1, 11],
    [11, 12],
    [12, 13],
    [0, 14],
    [14, 16],
    [0, 15],
    [15, 17],
];

let connect_color = [
    [0, 0, 255],
    [255, 0, 0],
    [255, 170, 0],
    [255, 255, 0],
    [255, 85, 0],
    [170, 255, 0],
    [85, 255, 0],
    [0, 255, 0],
    [0, 255, 85],
    [0, 255, 170],
    [0, 255, 255],
    [0, 170, 255],
    [0, 85, 255],
    [85, 0, 255],
    [170, 0, 255],
    [255, 0, 255],
    [255, 0, 170],
    [255, 0, 85],
];

const default_keypoints = [
    [241, 77],
    [241, 120],
    [191, 118],
    [177, 183],
    [163, 252],
    [298, 118],
    [317, 182],
    [332, 245],
    [225, 241],
    [213, 359],
    [215, 454],
    [270, 240],
    [282, 360],
    [286, 456],
    [232, 59],
    [253, 60],
    [225, 70],
    [260, 72],
];

class OpenPose {
    constructor(node, canvasElement) {
        this.lockMode = false;
        this.visibleEyes = true;
        this.flipped = false;
        this.node = node;
        this.undo_history = LS_Poses[node.name].undo_history || [];
        this.redo_history = LS_Poses[node.name].redo_history || [];
        this.history_change = false;
        this.canvas = this.initCanvas(canvasElement);
        // this.image = node.widgets.find((w) => w.name === "image");
        // 创建用于选择图片的input元素
        this.backgroundInput = document.createElement("input");
        this.backgroundInput.type = "file";
        this.backgroundInput.accept = "image/*";
        this.backgroundInput.style.display = "none";
        this.backgroundInput.addEventListener("change", this.onLoadBackground.bind(this));
        document.body.appendChild(this.backgroundInput);

    }

    // 创建更换背景的按钮
    //referenceImage() {
    //    button.addEventListener("click", () => this.backgroundInput.click());
    //}

    // 处理背景图片的加载
    onLoadBackground(e) {
        const file = this.backgroundInput.files[0];
        const url = URL.createObjectURL(file);
        this.setBackgroundImage(url);
    }

    // 设置背景图片
    setBackgroundImage(url) {
        fabric.Image.fromURL(url, (img) => {
            img.set({
                originX: 'left',
                originY: 'top',
                opacity: 0.5
            });
            /*
            var width = img.width; // 图片的宽度  
            var height = img.height; // 图片的高度  
            var minSideLength; // 最小边长  
            
            if (width < height) {  
              // 宽度小于高度，所以最短边是宽度  
              minSideLength = width;  
              img.scaleX = canvas.width / img.width;
              img.scaleY = canvas.width / img.width;
            } else {  
              // 宽度大于或等于高度，所以最短边是高度或两者相等  
              minSideLength = height;  
              img.scaleX = this.canvas.height / img.height;  
              img.scaleY = this.canvas.height / img.height;  
            }  
          */
            this.canvas.setWidth(img.width);
            this.canvas.setHeight(img.height);

            this.canvas.setBackgroundImage(img, this.canvas.renderAll.bind(this.canvas));
        });
    }

    setPose(keypoints) {
        this.canvas.clear();

        this.canvas.backgroundColor = "#000";

        const res = [];
        for (let i = 0; i < keypoints.length; i += 18) {
            const chunk = keypoints.slice(i, i + 18);
            res.push(chunk);
        }

        for (let item of res) {
            this.addPose(item);
            this.canvas.discardActiveObject();
        }
    }

    addPose(keypoints = undefined) {
        if (keypoints === undefined) {
            keypoints = default_keypoints;
        }


        // Calculate the scaling factor and offset to center the pose
        const canvasHeight = this.canvas.getHeight();
        const canvasWidth = this.canvas.getWidth();
        const targetHeight = canvasHeight * 0.8;
        const poseHeight = Math.max(...keypoints.map(kp => kp[1])) - Math.min(...keypoints.map(kp => kp[1]));
        const scaleFactor = targetHeight / poseHeight;
        const poseWidth = Math.max(...keypoints.map(kp => kp[0])) - Math.min(...keypoints.map(kp => kp[0]));
        const targetWidth = poseWidth * scaleFactor;
        
        // Calculate the original center of the pose
        const poseCenterX = (Math.max(...keypoints.map(kp => kp[0])) + Math.min(...keypoints.map(kp => kp[0]))) / 2;
        const poseCenterY = (Math.max(...keypoints.map(kp => kp[1])) + Math.min(...keypoints.map(kp => kp[1]))) / 2;

        // Calculate the canvas center
        const canvasCenterX = canvasWidth / 2;
        const canvasCenterY = canvasHeight / 2;

        // Calculate the offset to center the pose on the canvas
        const offsetX = canvasCenterX - (poseCenterX * scaleFactor);
        const offsetY = canvasCenterY - (poseCenterY * scaleFactor);

        // Scale and offset keypoints
        keypoints = keypoints.map(([x, y]) => [
            x * scaleFactor + offsetX,
            y * scaleFactor + offsetY
        ]);

        let scaledRadius = 5;
        let scaledLineWidth = 10;

        if (scaleFactor < 1) {
            // Define the minimum values for radius and line width
            const minRadius = 1;
            const minLineWidth = 2;

            // Calculate the scaled radius and line width
            scaledRadius = Math.max(5 * scaleFactor, minRadius);
            scaledLineWidth = Math.max(10 * scaleFactor, minLineWidth);
        }
        

        const group = new fabric.Group();

        const makeCircle = (
            color,
            left,
            top,
            line1,
            line2,
            line3,
            line4,
            line5
        ) => {
            let c = new fabric.Circle({
                left: left,
                top: top,
                strokeWidth: 1,
                radius: scaledRadius,
                fill: color,
                stroke: color,
            });

            c.hasControls = c.hasBorders = false;
            c.line1 = line1;
            c.line2 = line2;
            c.line3 = line3;
            c.line4 = line4;
            c.line5 = line5;
            c.isPose = true; // 添加自定义属性

            return c;
        };

        const makeLine = (coords, color) => {
            let line = new fabric.Line(coords, {
                fill: color,
                stroke: color,
                strokeWidth: scaledLineWidth,
                selectable: false,
                evented: false,
            });
            line.isPose = true; // 添加自定义属性
            return line;
        };

        const lines = [];
        const circles = [];

        for (let i = 0; i < connect_keypoints.length; i++) {
            // 接続されるidxを指定　[0, 1]なら0と1つなぐ
            const item = connect_keypoints[i];
            const line = makeLine(
                keypoints[item[0]].concat(keypoints[item[1]]),
                `rgba(${connect_color[i].join(", ")}, 0.7)`
            );
            lines.push(line);
            this.canvas.add(line);
        }

        for (let i = 0; i < keypoints.length; i++) {
            let list = [];

            connect_keypoints.filter((item, idx) => {
                if (item.includes(i)) {
                    list.push(lines[idx]);
                    return idx;
                }
            });
            const circle = makeCircle(
                `rgb(${connect_color[i].join(", ")})`,
                keypoints[i][0],
                keypoints[i][1],
                ...list
            );
            circle["id"] = i;
            circles.push(circle);
            group.addWithUpdate(circle);
        }

        this.canvas.discardActiveObject();
        this.canvas.setActiveObject(group);
        this.canvas.add(group);
        group.toActiveSelection();
        this.canvas.requestRenderAll();
    }

    initCanvas() {
        this.canvas = new fabric.Canvas(this.canvas, {
            backgroundColor: "#000",
            preserveObjectStacking: true,
        });

        const updateLines = (target) => {
            if ("_objects" in target) {
                const flipX = target.flipX ? -1 : 1;
                const flipY = target.flipY ? -1 : 1;
                this.flipped = flipX * flipY === -1;
                const showEyes = this.flipped ? !this.visibleEyes : this.visibleEyes;

                if (target.angle === 0) {
                    const rtop = target.top;
                    const rleft = target.left;
                    for (const item of target._objects) {
                        let p = item;
                        p.scaleX = 1;
                        p.scaleY = 1;
                        const top =
                            rtop +
                            p.top * target.scaleY * flipY +
                            (target.height * target.scaleY) / 2;
                        const left =
                            rleft +
                            p.left * target.scaleX * flipX +
                            (target.width * target.scaleX) / 2;
                        p["_top"] = top;
                        p["_left"] = left;
                        if (p["id"] === 0) {
                            p.line1 && p.line1.set({ x1: left, y1: top });
                        } else {
                            p.line1 && p.line1.set({ x2: left, y2: top });
                        }
                        if (p["id"] === 14 || p["id"] === 15) {
                            p.radius = showEyes ? 5 : 0;
                            if (p.line1) p.line1.strokeWidth = showEyes ? 10 : 0;
                            if (p.line2) p.line2.strokeWidth = showEyes ? 10 : 0;
                        }
                        p.line2 && p.line2.set({ x1: left, y1: top });
                        p.line3 && p.line3.set({ x1: left, y1: top });
                        p.line4 && p.line4.set({ x1: left, y1: top });
                        p.line5 && p.line5.set({ x1: left, y1: top });
                    }
                } else {
                    const aCoords = target.aCoords;
                    const center = {
                        x: (aCoords.tl.x + aCoords.br.x) / 2,
                        y: (aCoords.tl.y + aCoords.br.y) / 2,
                    };
                    const rad = (target.angle * Math.PI) / 180;
                    const sin = Math.sin(rad);
                    const cos = Math.cos(rad);

                    for (const item of target._objects) {
                        let p = item;
                        const p_top = p.top * target.scaleY * flipY;
                        const p_left = p.left * target.scaleX * flipX;
                        const left = center.x + p_left * cos - p_top * sin;
                        const top = center.y + p_left * sin + p_top * cos;
                        p["_top"] = top;
                        p["_left"] = left;
                        if (p["id"] === 0) {
                            p.line1 && p.line1.set({ x1: left, y1: top });
                        } else {
                            p.line1 && p.line1.set({ x2: left, y2: top });
                        }
                        if (p["id"] === 14 || p["id"] === 15) {
                            p.radius = showEyes ? 5 : 0.3;
                            if (p.line1) p.line1.strokeWidth = showEyes ? 10 : 0;
                            if (p.line2) p.line2.strokeWidth = showEyes ? 10 : 0;
                        }
                        p.line2 && p.line2.set({ x1: left, y1: top });
                        p.line3 && p.line3.set({ x1: left, y1: top });
                        p.line4 && p.line4.set({ x1: left, y1: top });
                        p.line5 && p.line5.set({ x1: left, y1: top });
                    }
                }
            } else {
                var p = target;
                if (p["id"] === 0) {
                    p.line1 && p.line1.set({ x1: p.left, y1: p.top });
                } else {
                    p.line1 && p.line1.set({ x2: p.left, y2: p.top });
                }
                p.line2 && p.line2.set({ x1: p.left, y1: p.top });
                p.line3 && p.line3.set({ x1: p.left, y1: p.top });
                p.line4 && p.line4.set({ x1: p.left, y1: p.top });
                p.line5 && p.line5.set({ x1: p.left, y1: p.top });
            }
            this.canvas.renderAll();
        };

        this.canvas.on("object:moving", (e) => {
            updateLines(e.target);
            this.uploadImage();
        });

        this.canvas.on("object:scaling", (e) => {
            updateLines(e.target);
            this.canvas.renderAll();
            this.uploadImage();
        });

        this.canvas.on("object:rotating", (e) => {
            updateLines(e.target);
            this.canvas.renderAll();
            this.uploadImage();
        });

        this.canvas.on("object:modified", () => {
            if (
                this.lockMode ||
                this.canvas.getActiveObject().type == "activeSelection"
            )
                return;
            this.undo_history.push(this.getJSON());
            this.redo_history.length = 0;
            this.history_change = true;
            this.uploadImage();
        });

        // if (!LS_Poses[this.node.name].undo_history.length) {
        //     this.setPose(default_keypoints);
        //     this.undo_history.push(this.getJSON());
        // }
        return this.canvas;
    }

    undo() {
        if (this.undo_history.length > 0) {
            this.lockMode = true;
            if (this.undo_history.length > 1)
                this.redo_history.push(this.undo_history.pop());

            const content = this.undo_history[this.undo_history.length - 1];
            this.loadPreset(content);
            this.canvas.renderAll();
            this.lockMode = false;
            this.history_change = true;
            this.uploadImage();
        }
    }

    redo() {
        if (this.redo_history.length > 0) {
            this.lockMode = true;
            const content = this.redo_history.pop();
            this.undo_history.push(content);
            this.loadPreset(content);
            this.canvas.renderAll();
            this.lockMode = false;
            this.history_change = true;
            this.uploadImage();
        }
    }

    resetCanvas() {
        this.canvas.clear();
        this.canvas.backgroundColor = "#000";
        // this.addPose();
        this.canvas.setBackgroundImage(null, this.canvas.renderAll.bind(this.canvas)); // 清除背景图像
        this.uploadImage();
    }

    updateHistoryData() {
        if (this.history_change) {
            LS_Poses[this.node.name].undo_history = this.undo_history;
            LS_Poses[this.node.name].redo_history = this.redo_history;
            LS_Save();
            this.history_change = false;
        }
    }

    uploadImage() {
        // 将 Blob 转换为 Base64 编码字符串
        const blobToBase64 = (blob) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        };
    
        // 上传 Base64 编码字符串到服务器
        const uploadBase64Image = async (base64Image) => {
            try {
                const body = new FormData();
                body.append('image', base64Image);
                await api.fetchApi("/upload_to_j", { method: "POST", body });
            } catch (error) {
                console.error("Error uploading image:", error);
            }
        };
    
        // 创建一个临时画布
        const tempCanvas = new fabric.Canvas(null, {
            width: this.canvas.width,
            height: this.canvas.height,
        });        
    
        // 复制需要的对象到临时画布
        this.canvas.forEachObject(function(obj) {
            if (obj.isPose) { // 只处理具有 isPose 属性的对象
                const clonedObj = fabric.util.object.clone(obj);
                tempCanvas.add(clonedObj);
            }
        });

        // 确保所有对象都正确渲染
        tempCanvas.renderAll();
    
        // 将临时画布内容转换为 Blob 对象
        tempCanvas.lowerCanvasEl.toBlob(async (blob) => {
            try {
                const base64Image = await blobToBase64(blob);
                console.log('base64:', base64Image);
                await uploadBase64Image(base64Image);
            } catch (error) {
                console.error("Error converting blob to base64:", error);
            } finally {
                // 清理临时画布
                tempCanvas.clear();
                tempCanvas.dispose();
            }
        }, "image/png");
    }
    

    getJSON() {
        const json = {
            keypoints: this.canvas
                .getObjects()
                .filter((item) => {
                    if (item.type === "circle") return item;
                })
                .map((item) => {
                    return [Math.round(item.left), Math.round(item.top)];
                }),
        };

        return json;
    }

    loadPreset(json) {
        try {
            if (json["keypoints"].length % 18 === 0) {
                this.setPose(json["keypoints"]);
            } else {
                throw new Error("keypoints is invalid");
            }
        } catch (e) {
            console.error(e);
        }
    }
}

// Create OpenPose widget
function createOpenPose(node, inputName, inputData, app) {
    node.name = inputName;
    const widget = {
        type: "openpose",
        name: `w${inputName}`,

        draw: function (ctx, _, widgetWidth, y, widgetHeight) {
            const margin = 10,
                visible = app.canvas.ds.scale > 0.5 && this.type === "openpose",
                clientRectBound = ctx.canvas.getBoundingClientRect(),
                transform = new DOMMatrix()
                    .scaleSelf(
                        clientRectBound.width / ctx.canvas.width,
                        clientRectBound.height / ctx.canvas.height
                    )
                    .multiplySelf(ctx.getTransform())
                    .translateSelf(margin, margin + y),
                w = (widgetWidth - margin * 2 - 3) * transform.a;

            Object.assign(this.openpose.style, {
                left: `${transform.a * margin + transform.e}px`,
                top: `${transform.d + transform.f}px`,
                width: w + "px",
                height: w + "px",
                position: "absolute",
                zIndex: app.graph._nodes.indexOf(node),
            });

            Object.assign(this.openpose.children[0].style, {
                width: w + "px",
                height: w + "px",
            });

            Object.assign(this.openpose.children[1].style, {
                width: w + "px",
                height: w + "px",
            });

            Array.from(this.openpose.children[2].children).forEach((element) => {
                Object.assign(element.style, {
                    width: `${28.0 * transform.a}px`,
                    height: `${22.0 * transform.d}px`,
                    fontSize: `${transform.d * 10.0}px`,
                });
                element.hidden = !visible;
            });
        },
    };

    // Fabric canvas
    let canvasOpenPose = document.createElement("canvas");
    node.openPose = new OpenPose(node, canvasOpenPose);

    node.openPose.canvas.setWidth(512);
    node.openPose.canvas.setHeight(512);

    // let widgetCombo = node.widgets.filter((w) => w.type === "combo");
    // widgetCombo[0].value = node.name;

    widget.openpose = node.openPose.canvas.wrapperEl;
    widget.parent = node;

    // Create elements undo, redo, clear history
    let panelButtons = document.createElement("div"),
        refButton = document.createElement("button"),
        undoButton = document.createElement("button"),
        redoButton = document.createElement("button"),
        historyClearButton = document.createElement("button");

    panelButtons.className = "panelButtons comfy-menu-btns";
    refButton.textContent = "Ref";
    undoButton.textContent = "undo";
    redoButton.textContent = "redo";
    historyClearButton.textContent = "✖";
    refButton.title = "Ref";
    undoButton.title = "Undo";
    redoButton.title = "Redo";
    historyClearButton.title = "Clear History";

    refButton.addEventListener("click", () => node.openPose.backgroundInput.click());
    undoButton.addEventListener("click", () => node.openPose.undo());
    redoButton.addEventListener("click", () => node.openPose.redo());
    historyClearButton.addEventListener("click", () => {
        if (confirm(`Delete all pose history of a node "${node.name}"?`)) {
            node.openPose.undo_history = [];
            node.openPose.redo_history = [];
            node.openPose.setPose(default_keypoints);
            node.openPose.undo_history.push(node.openPose.getJSON());
            node.openPose.history_change = true;
            node.openPose.updateHistoryData();
        }
    });

    panelButtons.appendChild(refButton);
    panelButtons.appendChild(undoButton);
    panelButtons.appendChild(redoButton);
    panelButtons.appendChild(historyClearButton);
    node.openPose.canvas.wrapperEl.appendChild(panelButtons);

    document.body.appendChild(widget.openpose);

    // Add buttons add, reset, undo, redo poses
    node.addWidget("button", "Add pose", "add_pose", () => {
        node.openPose.addPose();
    });

    node.addWidget("button", "clean all", "reset_pose", () => {
        node.openPose.resetCanvas();
    });
    // Add buttons Reference image
    // node.addWidget("button", "Reference image", "reference_image", () => {
    //  node.openPose.referenceImage();
    //});

    // Add customWidget to node
    node.addCustomWidget(widget);

    node.onRemoved = () => {
        if (Object.hasOwn(LS_Poses, node.name)) {
            delete LS_Poses[node.name];
            LS_Save();
        }

        // When removing this node we need to remove the input from the DOM
        for (let y in node.widgets) {
            if (node.widgets[y].openpose) {
                node.widgets[y].openpose.remove();
            }
        }
    };

    widget.onRemove = () => {
        widget.openpose?.remove();
    };

    app.canvas.onDrawBackground = function () {
        // Draw node isnt fired once the node is off the screen
        // if it goes off screen quickly, the input may not be removed
        // this shifts it off screen so it can be moved back if the node is visible.
        for (let n in app.graph._nodes) {
            n = app.graph._nodes[n];
            for (let w in n.widgets) {
                let wid = n.widgets[w];
                if (Object.hasOwn(wid, "openpose")) {
                    wid.openpose.style.left = -8000 + "px";
                    wid.openpose.style.position = "absolute";
                }
            }
        }
    };
    return { widget: widget };
}

window.LS_Poses = {};
function LS_Save() {
    ///console.log("Save:", LS_Poses);
    localStorage.setItem("ComfyUI_Poses", JSON.stringify(LS_Poses));
}

app.registerExtension({
    name: "OpenPose.Editor.Plus.J",
    async init(app) {
        // Any initial setup to run as soon as the page loads
        let style = document.createElement("style");
        style.innerText = `.panelButtons{
      position: absolute;
      padding: 4px;
      display: flex;
      gap: 4px;
      flex-direction: column;
      width: fit-content;
    }
    .panelButtons button:last-child{
      border-color: var(--error-text);
      color: var(--error-text) !important;
    }
    
    `;
        document.head.appendChild(style);
    },
    async setup(app) {
        console.log("OpenPose.Editor.Plus.J");
    },
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "OpenPose.Editor.Plus.J") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;

            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated
                    ? onNodeCreated.apply(this, arguments)
                    : undefined;

                let openPoseNode = app.graph._nodes.filter(
                    (wi) => { wi.type == "OpenPose.Editor.Plus.J" }
                ),
                    nodeName = `Pose_${openPoseNode.length}`,
                    nodeNamePNG = `${nodeName}.png`;

                console.log(`Create PoseNode: ${nodeName}`);

                LS_Poses =
                    localStorage.getItem("ComfyUI_Poses") &&
                    JSON.parse(localStorage.getItem("ComfyUI_Poses"));
                if (!LS_Poses) {
                    localStorage.setItem("ComfyUI_Poses", JSON.stringify({}));
                    LS_Poses = JSON.parse(localStorage.getItem("ComfyUI_Poses"));
                }

                if (!Object.hasOwn(LS_Poses, nodeNamePNG)) {
                    LS_Poses[nodeNamePNG] = {
                        undo_history: [],
                        redo_history: [],
                    };
                    LS_Save();
                }

                createOpenPose.apply(this, [this, nodeNamePNG, {}, app]);
                setTimeout(() => {
                    
                }, 1);

                this.setSize([530, 620]);

                return r;
            };
        }
    },
});