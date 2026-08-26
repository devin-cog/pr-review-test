"""Storage backends."""

from abc import ABC, abstractmethod
from typing import Any, Iterable


class AbstractStore(ABC):
    """Abstract key/value store interface."""

    @abstractmethod
    def put(self, key: str, value: Any) -> None: ...

    @abstractmethod
    def fetch(self, key: str) -> Any: ...

    @abstractmethod
    def values(self) -> Iterable[Any]: ...


class DictStore(AbstractStore):
    """The only store implementation."""

    def __init__(self) -> None:
        self._data: dict[str, Any] = {}

    def put(self, key: str, value: Any) -> None:
        self._data[key] = value

    def fetch(self, key: str) -> Any:
        return self._data[key]

    def values(self) -> Iterable[Any]:
        return list(self._data.values())
