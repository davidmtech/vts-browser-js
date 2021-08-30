module.exports = {
    "env": {
        "browser": true,
        "es2021": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 12,
        "sourceType": "module"
    },
    "rules": {
    },

    "ignorePatterns": ['three.module.js', '*.css', '*.png', '*.jpg'],

    "globals": {

        'VTS_DEVICE_WEBGL':             "readonly",
        'VTS_DEVICE_THREE':             "readonly",

        'VTS_MATERIAL_DEPTH':           "readonly",
        'VTS_MATERIAL_FLAT':            "readonly",
        'VTS_MATERIAL_FOG':             "readonly",
        'VTS_MATERIAL_INTERNAL':        "readonly",
        'VTS_MATERIAL_INTERNAL_NOFOG':  "readonly",
        'VTS_MATERIAL_EXTERNAL':        "readonly",
        'VTS_MATERIAL_EXTERNAL_NOFOG':  "readonly",

        'VTS_MAT_FLAG_UVS':   "readonly",
        'VTS_MAT_FLAG_C4':    "readonly",
        'VTS_MAT_FLAG_C8':    "readonly",
        'VTS_MAT_FLAG_FLAT':  "readonly",
        'VTS_MAT_FLAG_FOG':   "readonly",
        'VTS_MAT_FLAG_MASK':  "readonly",
        'VTS_MAT_FLAG_DEPTH': "readonly",

        'VTS_PIPELINE_BASIC':           "readonly",
        'VTS_PIPELINE_HMAP':            "readonly",
        'VTS_PIPELINE_PROCEDURAL':      "readonly",

        'VTS_DRAWCOMMAND_STATE':        "readonly",
        'VTS_DRAWCOMMAND_SUBMESH':      "readonly",
        'VTS_DRAWCOMMAND_GEODATA':      "readonly",

        'VTS_TEXTURECHECK_MEATATILE':   "readonly",
        'VTS_TEXTURECHECK_TYPE':        "readonly",
        'VTS_TEXTURECHECK_CODE':        "readonly",
        'VTS_TEXTURECHECK_SIZE':        "readonly",

        'VTS_TEXTURETYPE_COLOR':        "readonly",
        'VTS_TEXTURETYPE_HEIGHT':       "readonly",
        'VTS_TEXTURETYPE_CLASS':        "readonly",

        'VTS_JOB_FLAT_LINE':            "readonly",
        'VTS_JOB_FLAT_RLINE':           "readonly",
        'VTS_JOB_FLAT_TLINE':           "readonly",
        'VTS_JOB_PIXEL_LINE':           "readonly",
        'VTS_JOB_PIXEL_TLINE':          "readonly",
        'VTS_JOB_LINE_LABEL':           "readonly",
        'VTS_JOB_ICON':                 "readonly",
        'VTS_JOB_LABEL':                "readonly",
        'VTS_JOB_PACK':                 "readonly",
        'VTS_JOB_VSPOINT':              "readonly",
        'VTS_JOB_POLYGON':              "readonly",
        'VTS_JOB_MESH':                 "readonly",
        'VTS_JOB_POINTCLOUD':           "readonly",

        'VTS_TILE_COUNT_FACTOR':        "readonly",

        'VTS_NO_OVERLAP_DIRECT':        "readonly",
        'VTS_NO_OVERLAP_DIV_BY_DIST':   "readonly",

        'VTS_WORKERCOMMAND_ADD_RENDER_JOB':  "readonly",
        'VTS_WORKERCOMMAND_STYLE_DONE':      "readonly",
        'VTS_WORKERCOMMAND_ALL_PROCESSED':   "readonly",
        'VTS_WORKERCOMMAND_READY':           "readonly",
        'VTS_WORKERCOMMAND_GROUP_BEGIN':     "readonly",
        'VTS_WORKERCOMMAND_GROUP_END':       "readonly",
        'VTS_WORKERCOMMAND_LOAD_FONTS':      "readonly",
        'VTS_WORKERCOMMAND_LOAD_BITMPAS':    "readonly",

        'VTS_WORKER_TYPE_LABEL':             "readonly",
        'VTS_WORKER_TYPE_LABEL2':            "readonly",
        'VTS_WORKER_TYPE_ICON':              "readonly",
        'VTS_WORKER_TYPE_ICON2':             "readonly",
        'VTS_WORKER_TYPE_POINT_GEOMETRY':    "readonly",
        'VTS_WORKER_TYPE_FLAT_LINE':         "readonly",
        'VTS_WORKER_TYPE_FLAT_RLINE':        "readonly",
        'VTS_WORKER_TYPE_FLAT_TLINE':        "readonly",
        'VTS_WORKER_TYPE_PIXEL_LINE':        "readonly",
        'VTS_WORKER_TYPE_PIXEL_TLINE':       "readonly",
        'VTS_WORKER_TYPE_LINE_LABEL':        "readonly",
        'VTS_WORKER_TYPE_LINE_LABEL2':       "readonly",
        'VTS_WORKER_TYPE_POLYGON':           "readonly",
        'VTS_WORKER_TYPE_LINE_GEOMETRY':     "readonly",

        'VTS_WORKER_TYPE_PACK_BEGIN':       "readonly",
        'VTS_WORKER_TYPE_PACK_END':         "readonly",

        'VTS_WORKER_TYPE_VSWITCH_BEGIN':    "readonly",
        'VTS_WORKER_TYPE_VSWITCH_STORE':    "readonly",
        'VTS_WORKER_TYPE_VSWITCH_END':      "readonly",
        'VTS_WORKER_TYPE_VSPOINT':          "readonly",

        'VTS_WORKER_TYPE_NODE_BEGIN':       "readonly",
        'VTS_WORKER_TYPE_NODE_END':         "readonly",
        'VTS_WORKER_TYPE_MESH':             "readonly",
        'VTS_WORKER_TYPE_LOAD_NODE':        "readonly",

        'VTS_TILE_SHADER_CLIP4':            "readonly",
        'VTS_TILE_SHADER_CLIP8':            "readonly",
        'VTS_TILE_SHADER_SE':               "readonly",

        'VTS_IMPORATANCE_LOG_BASE':     "readonly",
        'VTS_IMPORATANCE_INV_LOG':      "readonly"

    }
};
