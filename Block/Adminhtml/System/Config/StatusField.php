<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Block\Adminhtml\System\Config;

use Hryvinskyi\DataLayerAdminUi\Model\Form\StatusTone;
use Magento\Framework\Data\Form\Element\AbstractElement;

/**
 * A settings row that shows a status and stores nothing: a coloured dot and the status on one line, an optional link
 * under it, and an optional note after it
 *
 * A subclass says what the status is for the scope being edited; this class draws it the same way for every status
 * row of the settings, whichever module adds the row.
 *
 * @phpstan-type Status array{
 *     tone: StatusTone,
 *     text: string,
 *     code?: bool,
 *     link?: array{url: string, label: string},
 *     note?: string
 * }
 */
abstract class StatusField extends ReadOnlyField
{
    /**
     * @var string
     */
    protected $_template = 'Hryvinskyi_DataLayerAdminUi::system/config/status-line.phtml';

    /**
     * Render the status through the template
     *
     * @param AbstractElement $element
     * @return string
     */
    protected function _getElementHtml(AbstractElement $element)
    {
        $status = $this->status($element);
        $this->assign('view', [
            'id' => (string) $element->getHtmlId(),
            'tone' => $status['tone']->value,
            'text' => $status['text'],
            'code' => $status['code'] ?? false,
            'linkUrl' => $status['link']['url'] ?? '',
            'linkLabel' => $status['link']['label'] ?? '',
            'note' => $status['note'] ?? '',
        ]);

        return $this->toHtml();
    }

    /**
     * Get the status to show for the scope being edited
     *
     * `code` sets the text in a monospace font that may break anywhere, for an address or an id; `link` adds a link
     * under the line, opened in a new window; `note` adds a note after it.
     *
     * @param AbstractElement $element
     * @return Status
     */
    abstract protected function status(AbstractElement $element): array;
}
