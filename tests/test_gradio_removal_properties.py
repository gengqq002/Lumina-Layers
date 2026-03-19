"""Property-Based tests for the Gradio removal feature.
Gradio 移除功能的 Property-Based 测试。

Uses Hypothesis to verify that refactored core functions return pure Python
types and never depend on Gradio modules.
使用 Hypothesis 验证重构后的核心函数返回纯 Python 类型，不依赖 Gradio 模块。
"""

import sys

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from core.converter import detect_image_type
from config import ModelingMode


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Common raster image extensions
_RASTER_EXTS = [".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif", ".webp", ".heic"]

# Strategy: file paths with various extensions (raster images)
raster_paths = st.sampled_from(_RASTER_EXTS).flatmap(
    lambda ext: st.text(
        alphabet=st.characters(whitelist_categories=("L", "N"), whitelist_characters="_-/\\"),
        min_size=1,
        max_size=50,
    ).map(lambda stem: stem + ext)
)

# Strategy: SVG file paths (stem must contain at least 1 alphanumeric char
# so os.path.splitext correctly identifies .svg as the extension)
svg_paths = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N"), whitelist_characters="_-/\\"),
    min_size=1,
    max_size=50,
).filter(
    lambda s: len(s) > 0 and s[-1] not in "/\\"
).map(lambda stem: stem + ".svg")

# Strategy: paths without any extension
no_ext_paths = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N"), whitelist_characters="_-/\\"),
    min_size=1,
    max_size=50,
).filter(lambda s: "." not in s)

# Strategy: all possible inputs including None and empty string
all_inputs = st.one_of(
    st.none(),
    st.just(""),
    svg_paths,
    raster_paths,
    no_ext_paths,
)


# ---------------------------------------------------------------------------
# Feature: gradio-removal, Property 1: detect_image_type 返回纯 Python 类型
# **Validates: Requirements 3.4, 3.5**
# ---------------------------------------------------------------------------


class TestDetectImageTypeProperty:
    """Property 1: detect_image_type always returns pure Python types (str | None)."""

    @given(path=all_inputs)
    @settings(max_examples=200)
    def test_return_type_is_str_or_none(self, path: str | None) -> None:
        """For any input, detect_image_type returns str or None, never a Gradio object.
        对任意输入，detect_image_type 返回 str 或 None，绝不返回 Gradio 对象。
        """
        result = detect_image_type(path)
        assert result is None or isinstance(result, str), (
            f"Expected str or None, got {type(result).__name__}: {result!r}"
        )

    @given(path=all_inputs)
    @settings(max_examples=200)
    def test_no_gradio_module_dependency(self, path: str | None) -> None:
        """Calling detect_image_type never causes gradio to be imported.
        调用 detect_image_type 不会导致 gradio 被导入。
        """
        # Remove gradio from sys.modules if present, then call the function
        had_gradio = "gradio" in sys.modules
        if had_gradio:
            saved = sys.modules.pop("gradio")
        try:
            result = detect_image_type(path)
            assert "gradio" not in sys.modules, (
                "detect_image_type caused 'gradio' to be imported"
            )
        finally:
            if had_gradio:
                sys.modules["gradio"] = saved

    @given(path=svg_paths)
    @settings(max_examples=100)
    def test_svg_returns_vector_mode(self, path: str) -> None:
        """For any .svg path, detect_image_type returns ModelingMode.VECTOR.
        对任意 .svg 路径，detect_image_type 返回 ModelingMode.VECTOR。
        """
        result = detect_image_type(path)
        assert result == ModelingMode.VECTOR, (
            f"Expected ModelingMode.VECTOR ('{ModelingMode.VECTOR}'), got {result!r}"
        )

    @given(path=raster_paths)
    @settings(max_examples=100)
    def test_non_svg_returns_none(self, path: str) -> None:
        """For any non-svg image path, detect_image_type returns None.
        对任意非 svg 图像路径，detect_image_type 返回 None。
        """
        result = detect_image_type(path)
        assert result is None, (
            f"Expected None for raster path '{path}', got {result!r}"
        )

    def test_none_input_returns_none(self) -> None:
        """None input returns None.
        None 输入返回 None。
        """
        assert detect_image_type(None) is None

    def test_empty_string_returns_none(self) -> None:
        """Empty string input returns None.
        空字符串输入返回 None。
        """
        assert detect_image_type("") is None


# ---------------------------------------------------------------------------
# Strategies for Property 2
# ---------------------------------------------------------------------------

# Strategy: pixel coordinates as tuple[int, int]
# LUT preview images are typically 512x512, so coordinates range 0..511
pixel_coords = st.tuples(
    st.integers(min_value=0, max_value=511),
    st.integers(min_value=0, max_value=511),
)


# ---------------------------------------------------------------------------
# Feature: gradio-removal, Property 2: probe_lut_cell 接受纯 Python 坐标参数
# **Validates: Requirements 3.7**
# ---------------------------------------------------------------------------


class TestProbeLutCellProperty:
    """Property 2: probe_lut_cell accepts pure Python coordinate parameters."""

    @given(coords=pixel_coords)
    @settings(max_examples=200)
    def test_return_type_is_correct_tuple(self, coords: tuple[int, int]) -> None:
        """For any coordinates with lut_path=None, probe_lut_cell returns the expected tuple type.
        对任意坐标（lut_path=None），probe_lut_cell 返回预期的 tuple 类型。
        """
        from core.extractor import probe_lut_cell

        result = probe_lut_cell(None, coords)

        # Must be a 3-element tuple
        assert isinstance(result, tuple), (
            f"Expected tuple, got {type(result).__name__}"
        )
        assert len(result) == 3, (
            f"Expected 3-element tuple, got {len(result)} elements"
        )

        info_str, hex_color, grid_coords = result

        # Element 0: always a str
        assert isinstance(info_str, str), (
            f"Expected str for info, got {type(info_str).__name__}"
        )

        # Element 1: str or None
        assert hex_color is None or isinstance(hex_color, str), (
            f"Expected str|None for hex_color, got {type(hex_color).__name__}"
        )

        # Element 2: tuple[int, int] or None
        assert grid_coords is None or (
            isinstance(grid_coords, tuple) and len(grid_coords) == 2
        ), (
            f"Expected tuple[int,int]|None for grid_coords, got {grid_coords!r}"
        )

    @given(coords=pixel_coords)
    @settings(max_examples=200)
    def test_no_gradio_module_dependency(self, coords: tuple[int, int]) -> None:
        """Calling probe_lut_cell never causes gradio to be imported.
        调用 probe_lut_cell 不会导致 gradio 被导入。
        """
        from core.extractor import probe_lut_cell

        had_gradio = "gradio" in sys.modules
        if had_gradio:
            saved = sys.modules.pop("gradio")
        try:
            probe_lut_cell(None, coords)
            assert "gradio" not in sys.modules, (
                "probe_lut_cell caused 'gradio' to be imported"
            )
        finally:
            if had_gradio:
                sys.modules["gradio"] = saved

    @given(coords=pixel_coords)
    @settings(max_examples=100)
    def test_nonexistent_lut_returns_warning(self, coords: tuple[int, int]) -> None:
        """With a non-existent lut_path, probe_lut_cell returns a warning and None values.
        当 lut_path 指向不存在的文件时，probe_lut_cell 返回警告字符串和 None 值。
        """
        from core.extractor import probe_lut_cell

        fake_path = "/tmp/_nonexistent_lut_test_file_12345.json"
        info_str, hex_color, grid_coords = probe_lut_cell(fake_path, coords)

        assert "[WARNING]" in info_str, (
            f"Expected warning message, got: {info_str!r}"
        )
        assert hex_color is None
        assert grid_coords is None
