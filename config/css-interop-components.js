"use strict";
// Copie de react-native-css-interop@0.2.7 / dist/runtime/components.js SANS ImageBackground.
// Pourquoi : la bibliothèque lit `ImageBackground` de react-native au démarrage, ce qui déclenche
// l'avertissement « ImageBackground is deprecated ». Sovmilo n'utilise jamais ImageBackground.
// Branchement : metro.config.js (resolveRequest). À revérifier si react-native-css-interop est mis à jour.
const react_native_1 = require("react-native");
const api_1 = require("react-native-css-interop/dist/runtime/api");

(0, api_1.cssInterop)(react_native_1.Image, { className: "style" });
(0, api_1.cssInterop)(react_native_1.Pressable, { className: "style" });
(0, api_1.cssInterop)(react_native_1.Switch, { className: "style" });
(0, api_1.cssInterop)(react_native_1.Text, { className: "style" });
(0, api_1.cssInterop)(react_native_1.TouchableHighlight, { className: "style" });
(0, api_1.cssInterop)(react_native_1.TouchableOpacity, { className: "style" });
(0, api_1.cssInterop)(react_native_1.TouchableWithoutFeedback, { className: "style" });
(0, api_1.cssInterop)(react_native_1.View, { className: "style" });
(0, api_1.cssInterop)(react_native_1.ActivityIndicator, {
  className: { target: "style", nativeStyleToProp: { color: true } },
});
(0, api_1.cssInterop)(react_native_1.StatusBar, {
  className: { target: false, nativeStyleToProp: { backgroundColor: true } },
});
(0, api_1.cssInterop)(react_native_1.ScrollView, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
});
(0, api_1.cssInterop)(react_native_1.TextInput, {
  className: { target: "style", nativeStyleToProp: { textAlign: true } },
});
(0, api_1.remapProps)(react_native_1.FlatList, {
  className: "style",
  ListFooterComponentClassName: "ListFooterComponentStyle",
  ListHeaderComponentClassName: "ListHeaderComponentStyle",
  columnWrapperClassName: "columnWrapperStyle",
  contentContainerClassName: "contentContainerStyle",
});
(0, api_1.remapProps)(react_native_1.KeyboardAvoidingView, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
});
(0, api_1.remapProps)(react_native_1.VirtualizedList, {
  className: "style",
  ListFooterComponentClassName: "ListFooterComponentStyle",
  ListHeaderComponentClassName: "ListHeaderComponentStyle",
  contentContainerClassName: "contentContainerStyle",
});
try {
  const SafeAreaView = require("react-native-safe-area-context").SafeAreaView;
  (0, api_1.cssInterop)(SafeAreaView, { className: "style" });
} catch {}
