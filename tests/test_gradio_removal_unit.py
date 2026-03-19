"""Unit tests for the Gradio removal feature.
Gradio 移除功能的单元测试。

Verifies that all Gradio references have been removed from core files,
configuration files are updated correctly, and obsolete files/directories
no longer exist.
验证所有 Gradio 引用已从核心文件中移除，配置文件已正确更新，
废弃的文件/目录不再存在。
"""

import os
import re

import pytest

# Project root directory (one level up from tests/)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _read_file(relative_path: str) -> str:
    """Read file content relative to project root.
    读取项目根目录下的文件内容。
    """
    full_path = os.path.join(PROJECT_ROOT, relative_path)
    with open(full_path, "r", encoding="utf-8") as f:
        return f.read()


def _strip_comments(line: str) -> str:
    """Remove Python inline comments from a line.
    移除 Python 行内注释。
    """
    # Naive but sufficient: split on # outside strings
    in_string = None
    for i, ch in enumerate(line):
        if ch in ('"', "'") and (i == 0 or line[i - 1] != "\\"):
            if in_string is None:
                in_string = ch
            elif in_string == ch:
                in_string = None
        elif ch == "#" and in_string is None:
            return line[:i]
    return line


def _file_has_gradio_import(relative_path: str) -> bool:
    """Check if a file contains 'import gradio' outside of comments.
    检查文件是否在非注释区域包含 'import gradio'。
    """
    content = _read_file(relative_path)
    for line in content.splitlines():
        stripped = _strip_comments(line).strip()
        if re.search(r"\bimport\s+gradio\b", stripped) or re.search(r"\bfrom\s+gradio\b", stripped):
            return True
    return False


# ---------------------------------------------------------------------------
# 1. Core files don't contain Gradio references
# Validates: Requirements 3.1, 3.2, 3.3, 3.8
# ---------------------------------------------------------------------------


class TestCoreNoGradioReferences:
    """Verify core/ files contain no Gradio imports or API usage."""

    def test_converter_no_import_gradio(self) -> None:
        """core/converter.py has no 'import gradio' statement."""
        assert not _file_has_gradio_import("core/converter.py"), (
            "core/converter.py still contains 'import gradio'"
        )

    def test_converter_no_gr_update(self) -> None:
        """core/converter.py has no gr.update() calls."""
        content = _read_file("core/converter.py")
        code_lines = [_strip_comments(line) for line in content.splitlines()]
        code_text = "\n".join(code_lines)
        assert "gr.update()" not in code_text, (
            "core/converter.py still contains 'gr.update()'"
        )

    def test_converter_no_gr_selectdata(self) -> None:
        """core/converter.py has no gr.SelectData references."""
        content = _read_file("core/converter.py")
        code_lines = [_strip_comments(line) for line in content.splitlines()]
        code_text = "\n".join(code_lines)
        assert "gr.SelectData" not in code_text, (
            "core/converter.py still contains 'gr.SelectData'"
        )

    def test_extractor_no_import_gradio(self) -> None:
        """core/extractor.py has no 'import gradio' statement."""
        assert not _file_has_gradio_import("core/extractor.py"), (
            "core/extractor.py still contains 'import gradio'"
        )

    def test_extractor_no_gr_selectdata(self) -> None:
        """core/extractor.py has no gr.SelectData references."""
        content = _read_file("core/extractor.py")
        code_lines = [_strip_comments(line) for line in content.splitlines()]
        code_text = "\n".join(code_lines)
        assert "gr.SelectData" not in code_text, (
            "core/extractor.py still contains 'gr.SelectData'"
        )

    def test_pipeline_utils_no_import_gradio(self) -> None:
        """core/pipeline/pipeline_utils.py has no 'import gradio' statement."""
        assert not _file_has_gradio_import("core/pipeline/pipeline_utils.py"), (
            "core/pipeline/pipeline_utils.py still contains 'import gradio'"
        )

    def test_pipeline_utils_no_gr_update(self) -> None:
        """core/pipeline/pipeline_utils.py has no gr.update() calls."""
        content = _read_file("core/pipeline/pipeline_utils.py")
        code_lines = [_strip_comments(line) for line in content.splitlines()]
        code_text = "\n".join(code_lines)
        assert "gr.update()" not in code_text, (
            "core/pipeline/pipeline_utils.py still contains 'gr.update()'"
        )

    def test_all_core_files_no_gradio_import(self) -> None:
        """No .py file in core/ (recursively) contains 'import gradio' outside comments."""
        core_dir = os.path.join(PROJECT_ROOT, "core")
        violations = []
        for root, _dirs, files in os.walk(core_dir):
            for fname in files:
                if not fname.endswith(".py"):
                    continue
                rel_path = os.path.relpath(os.path.join(root, fname), PROJECT_ROOT)
                if _file_has_gradio_import(rel_path):
                    violations.append(rel_path)
        assert not violations, (
            f"Found 'import gradio' in core/ files: {violations}"
        )


# ---------------------------------------------------------------------------
# 2. requirements.txt doesn't contain gradio
# Validates: Requirements 2.1
# ---------------------------------------------------------------------------


class TestRequirementsNoGradio:
    """Verify requirements.txt has no gradio dependency."""

    def test_no_gradio_in_requirements(self) -> None:
        """requirements.txt does not contain 'gradio' as a dependency."""
        content = _read_file("requirements.txt")
        for line in content.splitlines():
            stripped = line.strip()
            # Skip comments and empty lines
            if not stripped or stripped.startswith("#"):
                continue
            assert not re.match(r"^gradio\b", stripped, re.IGNORECASE), (
                f"requirements.txt still contains gradio dependency: '{stripped}'"
            )


# ---------------------------------------------------------------------------
# 3. Dockerfile uses correct port and entry point
# Validates: Requirements 4.1, 4.2
# ---------------------------------------------------------------------------


class TestDockerfileConfig:
    """Verify Dockerfile exposes port 8000 and uses api_server.py."""

    def test_exposes_port_8000(self) -> None:
        """Dockerfile contains 'EXPOSE 8000'."""
        content = _read_file("Dockerfile")
        assert re.search(r"^EXPOSE\s+8000\s*$", content, re.MULTILINE), (
            "Dockerfile does not contain 'EXPOSE 8000'"
        )

    def test_cmd_api_server(self) -> None:
        """Dockerfile CMD runs api_server.py."""
        content = _read_file("Dockerfile")
        assert 'CMD ["python", "api_server.py"]' in content, (
            "Dockerfile does not contain 'CMD [\"python\", \"api_server.py\"]'"
        )

    def test_no_expose_7860(self) -> None:
        """Dockerfile does NOT contain 'EXPOSE 7860'."""
        content = _read_file("Dockerfile")
        assert not re.search(r"^EXPOSE\s+7860\s*$", content, re.MULTILINE), (
            "Dockerfile still contains 'EXPOSE 7860' (Gradio port)"
        )

    def test_no_main_py_reference(self) -> None:
        """Dockerfile does NOT reference main.py in CMD or ENTRYPOINT."""
        content = _read_file("Dockerfile")
        # Check CMD and ENTRYPOINT lines only
        for line in content.splitlines():
            stripped = line.strip()
            if stripped.startswith(("CMD", "ENTRYPOINT")):
                assert "main.py" not in stripped, (
                    f"Dockerfile still references main.py: '{stripped}'"
                )


# ---------------------------------------------------------------------------
# 4. lumina_studio.spec points to api_server.py
# Validates: Requirements 5.1
# ---------------------------------------------------------------------------


class TestPyInstallerSpec:
    """Verify lumina_studio.spec uses api_server.py as entry point."""

    def test_entry_point_is_api_server(self) -> None:
        """lumina_studio.spec contains ['api_server.py'] as Analysis entry."""
        content = _read_file("lumina_studio.spec")
        assert "['api_server.py']" in content, (
            "lumina_studio.spec does not contain \"['api_server.py']\" as entry point"
        )

    def test_no_main_py_entry(self) -> None:
        """lumina_studio.spec does NOT contain ['main.py'] as Analysis entry."""
        content = _read_file("lumina_studio.spec")
        assert "['main.py']" not in content, (
            "lumina_studio.spec still contains \"['main.py']\" as entry point"
        )


# ---------------------------------------------------------------------------
# 5. ui/ directory does not exist
# Validates: Requirements 1.1
# ---------------------------------------------------------------------------


class TestUiDirectoryRemoved:
    """Verify the ui/ directory has been completely removed."""

    def test_ui_directory_not_exists(self) -> None:
        """ui/ directory does not exist."""
        ui_path = os.path.join(PROJECT_ROOT, "ui")
        assert not os.path.exists(ui_path), (
            f"ui/ directory still exists at {ui_path}"
        )


# ---------------------------------------------------------------------------
# 6. main.py does not exist
# Validates: Requirements 1.2
# ---------------------------------------------------------------------------


class TestMainPyRemoved:
    """Verify main.py (Gradio entry point) has been removed."""

    def test_main_py_not_exists(self) -> None:
        """main.py does not exist in project root."""
        main_path = os.path.join(PROJECT_ROOT, "main.py")
        assert not os.path.exists(main_path), (
            f"main.py still exists at {main_path}"
        )
